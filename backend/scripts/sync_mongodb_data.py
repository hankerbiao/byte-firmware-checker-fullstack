#!/usr/bin/env python3
"""Copy firmware audit data from the legacy MongoDB instance to the new cluster.

The command is dry-run by default. It copies collection options, documents, and
non-default indexes from the fixed legacy database to the fixed target database.
Documents retain their original ``_id`` and are upserted, so an interrupted import
can be resumed safely. The source must be quiesced before an applied import.
"""

from __future__ import annotations

import argparse
import os
import sys
from collections.abc import Iterable
from typing import Any

from pymongo import MongoClient, ReplaceOne
from pymongo.collection import Collection
from pymongo.database import Database
from pymongo.errors import BulkWriteError, PyMongoError

LEGACY_MONGO_URI = "mongodb://10.17.154.252:27018"
LEGACY_DB_NAME = "firmware_audit"
TARGET_MONGO_URI = (
    "mongodb://10.17.159.232:27017,10.17.159.228:27017,"
    "10.17.158.254:27017/?authSource=admin"
)
TARGET_DB_NAME = "byte-firmware-checker"
TARGET_USERNAME = "byte-firmware-checker"
TARGET_AUTH_SOURCE = "admin"
BATCH_SIZE = 1_000


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Synchronize legacy firmware audit collections into the new MongoDB cluster."
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Perform the copy. Without this flag, only validate source and target state.",
    )
    parser.add_argument(
        "--source-quiesced",
        action="store_true",
        help="Confirm legacy writes are paused for the whole applied migration.",
    )
    parser.add_argument(
        "--resume",
        action="store_true",
        help="Allow upserting into a target database left partially populated by a prior run.",
    )
    return parser.parse_args()


def batched(items: Iterable[dict[str, Any]], size: int) -> Iterable[list[dict[str, Any]]]:
    batch: list[dict[str, Any]] = []
    for item in items:
        batch.append(item)
        if len(batch) == size:
            yield batch
            batch = []
    if batch:
        yield batch


def collection_names(database: Database) -> list[str]:
    return sorted(name for name in database.list_collection_names() if not name.startswith("system."))


def collection_options(database: Database, name: str) -> dict[str, Any]:
    response = database.command("listCollections", filter={"name": name}, nameOnly=False)
    collections = response["cursor"]["firstBatch"]
    if len(collections) != 1:
        raise RuntimeError(f"Could not read metadata for source collection {name!r}")
    return collections[0].get("options", {})


def ensure_collection(source: Database, target: Database, name: str) -> None:
    if name not in target.list_collection_names():
        target.create_collection(name, **collection_options(source, name))


def copy_indexes(source: Collection, target: Collection) -> None:
    for index in source.list_indexes():
        if index["name"] == "_id_":
            continue

        options = {key: value for key, value in index.items() if key not in {"v", "key", "ns"}}
        target.create_index(index["key"].items(), **options)


def sync_collection(source: Collection, target: Collection) -> int:
    document_count = 0
    for documents in batched(source.find({}), BATCH_SIZE):
        operations = [ReplaceOne({"_id": document["_id"]}, document, upsert=True) for document in documents]
        try:
            target.bulk_write(operations, ordered=False)
        except BulkWriteError as exc:
            raise RuntimeError(f"Failed copying collection {source.name}: {exc.details}") from exc
        document_count += len(documents)
    copy_indexes(source, target)
    return document_count


def main() -> int:
    args = parse_args()
    password = os.getenv("MONGO_PASSWORD")
    if not password:
        print("MONGO_PASSWORD is required for the target MongoDB cluster.", file=sys.stderr)
        return 2

    target_kwargs = {
        "username": TARGET_USERNAME,
        "password": password,
        "authSource": TARGET_AUTH_SOURCE,
    }
    try:
        with MongoClient(LEGACY_MONGO_URI, serverSelectionTimeoutMS=10_000) as source_client, MongoClient(
            TARGET_MONGO_URI, serverSelectionTimeoutMS=10_000, **target_kwargs
        ) as target_client:
            source = source_client[LEGACY_DB_NAME]
            target = target_client[TARGET_DB_NAME]
            source.command("ping")
            target.command("ping")

            source_collections = collection_names(source)
            target_collections = collection_names(target)
            unexpected_collections = sorted(set(target_collections) - set(source_collections))
            if unexpected_collections:
                print(
                    f"Target database {TARGET_DB_NAME!r} has collections not found in the legacy source: "
                    f"{', '.join(unexpected_collections)}.",
                    file=sys.stderr,
                )
                return 3
            if target_collections and not args.resume:
                print(
                    f"Target database {TARGET_DB_NAME!r} is not empty: {', '.join(target_collections)}. "
                    "Use --resume only for a previous interrupted migration.",
                    file=sys.stderr,
                )
                return 3

            source_counts = {name: source[name].count_documents({}) for name in source_collections}
            print(f"Source {LEGACY_DB_NAME!r}: {len(source_collections)} collections")
            print(f"Target {TARGET_DB_NAME!r}: {len(target_collections)} collections")
            if not args.apply:
                print("Dry run complete. Re-run with --apply to copy data.")
                return 0
            if not args.source_quiesced:
                print("--source-quiesced is required with --apply.", file=sys.stderr)
                return 4

            copied = 0
            for name in source_collections:
                ensure_collection(source, target, name)
                count = sync_collection(source[name], target[name])
                copied += count
                print(f"Copied {count} documents from {name}")

            changed_sources = [
                name for name, expected_count in source_counts.items() if source[name].count_documents({}) != expected_count
            ]
            mismatched_targets = [
                name for name, expected_count in source_counts.items() if target[name].count_documents({}) != expected_count
            ]
            if changed_sources or mismatched_targets:
                print(
                    "Verification failed. "
                    f"Changed source collections: {', '.join(changed_sources) or 'none'}; "
                    f"target count mismatches: {', '.join(mismatched_targets) or 'none'}.",
                    file=sys.stderr,
                )
                return 5
            print(f"Sync complete: {copied} documents across {len(source_collections)} collections.")
    except PyMongoError as exc:
        print(f"MongoDB operation failed: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
