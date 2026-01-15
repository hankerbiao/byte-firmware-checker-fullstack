# 新版 `log_assert` 与 Mongo 写入设计方案

> 目标：在尽量少改动现有检查脚本的前提下，通过增强 `log_assert` 实现执行过程日志（ConsoleLog）和成功/失败统计的持久化，支撑基于 `/audits/{id}/logs` 和 `/audits/{id}/report` 的后端服务。

---

## 1. 设计背景

当前脚本特征：

- 各类检查函数（`test_firmware_naming`, `test_paths_in_zip` 等）内部大量调用 `log_assert`；
- `run_all_tests` 负责统一调用所有 `test_*` 并在结束时统计 `[PASS] / [WARNING] / [ERROR]` 的数量；
- 输出以日志文件和 `print` 为主，不适合作为服务接口的直接数据源。

服务化后的需求：

- 需要为每次审计任务（`/audits/{id}`）提供：
  - ConsoleLog 流（`/audits/{id}/logs`）；
  - 成功/失败/告警数量以及最终报告数据（`/audits/{id}/report`）。
- 不希望大幅重写现有 `test_*` 逻辑，更倾向在公共出口处打埋点。

核心思路：

- 将 `log_assert` 视为“检查结果的统一出口”，在其内部新增：
  - 状态统计（pass/warning/fail/total）；
  - 向 MongoDB 写入 ConsoleLog 文档；
- 在 `run_all_tests` 的开始和结束阶段，结合统计结果写入任务与报告数据。

---

## 2. 新版 `log_assert` 函数签名设计

在不破坏现有调用方式的基础上，为 `log_assert` 增加可选的上下文参数与步骤信息。

### 2.1 现状（示意）

当前调用形式示例（简化）：

```python
log_assert(
    condition,
    "检查根目录: ...",
    test_name
)

log_assert(
    condition,
    "不是首次提交，全量报告非必须: ...",
    test_name,
    fail_level=logging.WARNING
)
```

可以推断当前签名类似：

```python
def log_assert(condition, message, test_name, fail_level=logging.ERROR):
    ...
```

### 2.2 新签名（向后兼容）

在此基础上，增加两个关键参数：

- `context`: 审计上下文对象（包含 audit_id、Mongo 句柄、统计信息等）；
- `step`: 可选的步骤编号（与原脚本中的“步骤 1~35”对齐）。

新的函数签名示意：

```python
def log_assert(
    condition: bool,
    message: str,
    test_name: str,
    fail_level: int = logging.ERROR,
    context: "AuditContext | None" = None,
    step: int | None = None,
) -> bool:
    ...
```

说明：

- 对现有调用方保持兼容：已有调用不传 `context`/`step` 也能正常工作；
- 新代码（或迁移中的代码）可在需要的地方显式传入 `context` 与步骤号；
- `AuditContext` 在本方案中只用于设计说明，实际实现时可以放在独立模块中。

---

## 3. 审计上下文 `AuditContext` 设计

`AuditContext` 用于在检查过程中的任意位置访问与当前审计任务相关的运行信息和资源。

示例定义（伪代码）：

```python
from dataclasses import dataclass, field
from typing import Optional
from datetime import datetime

from pymongo.database import Database


@dataclass
class AuditRunStats:
    total: int = 0
    passed: int = 0
    warning: int = 0
    failed: int = 0


@dataclass
class AuditContext:
    audit_id: str
    db: Database  # 包含 audits / audit_logs / audit_reports 等集合
    stats: AuditRunStats = field(default_factory=AuditRunStats)
    started_at: datetime = field(default_factory=datetime.utcnow)
```

说明：

- `audit_id`：当前审计任务 ID，与 `openapi.json` 中的 `/audits/{id}` 保持一致；
- `db`：MongoDB `Database` 对象（或一个封装好的 Repository），用于写入：
  - `audit_logs`（ConsoleLog）
  - `audits`（任务状态）
  - `audit_reports`（最终报告）；
- `stats`：运行期间累积的统计信息；
- `started_at`：任务开始时间，用于最终报告和耗时计算。

在实际代码中，`AuditContext` 由服务层创建并传递给 `run_all_tests`，再由 `run_all_tests` 传递给 `log_assert`（可以直接传，也可以通过某种全局/线程局部存储访问，视实现策略而定）。

---

## 4. `log_assert` 内部逻辑与 Mongo 写入示意

新版 `log_assert` 的核心职责：

1. 按原有逻辑写文件日志、返回布尔结果；
2. 根据 `condition` 与 `fail_level` 更新 `context.stats`；
3. 构造一条 ConsoleLog 文档写入 Mongo `audit_logs` 集合。

### 4.1 状态统计逻辑

伪代码：

```python
def _update_stats(condition: bool, fail_level: int, context: AuditContext) -> None:
    context.stats.total += 1

    if condition:
        if fail_level == logging.WARNING:
            context.stats.warning += 1
        else:
            context.stats.passed += 1
    else:
        if fail_level == logging.WARNING:
            context.stats.warning += 1
        else:
            context.stats.failed += 1
```

说明：

- PASS 情况下：`passed += 1`（或根据需要将 Warning 单独计数）；
- FAIL 情况下：
  - 若 `fail_level` 为 WARNING：视为告警；
  - 若为 ERROR：计入失败。

### 4.2 ConsoleLog 文档结构

根据 `openapi.json` 中的 `ConsoleLog` 定义，以及前面 Mongo 设计：

- 集合：`audit_logs`
- 文档示例：

```json
{
  "auditId": "AUDIT-123456",
  "message": "[test_firmware_naming] 命名符合规范: xxx.zip",
  "timestamp": "2025-01-01T12:34:56.789Z",
  "level": "success",
  "meta": {
    "testName": "test_firmware_naming",
    "step": 5
  }
}
```

`level` 映射规则示例：

- 当 `condition=True` 且 `fail_level` 非 WARNING：
  - `"success"` 或 `"info"`；
- 当 `condition=True` 且 `fail_level` 为 WARNING（用于“非必选但存在”这类情况）：
  - `"info"`；
- 当 `condition=False` 且 `fail_level` 为 WARNING：
  - `"warn"`；
- 当 `condition=False` 且 `fail_level` 为 ERROR：
  - `"error"`。

### 4.3 `log_assert` 伪代码整合

综合以上逻辑，新版 `log_assert` 的伪代码如下：

```python
from datetime import datetime, timezone


def log_assert(
    condition: bool,
    message: str,
    test_name: str,
    fail_level: int = logging.ERROR,
    context: AuditContext | None = None,
    step: int | None = None,
) -> bool:
    # 1. 保持原有行为：写文件日志，可能打印到控制台
    #   （此处省略具体实现）

    # 2. 如果没有传 context，直接返回，保持向后兼容
    if context is None:
        return condition

    # 3. 更新统计信息
    _update_stats(condition, fail_level, context)

    # 4. 构造 ConsoleLog 文档
    ts = datetime.now(timezone.utc)

    if condition:
        if fail_level == logging.WARNING:
            level = "info"
        else:
            level = "success"
    else:
        if fail_level == logging.WARNING:
            level = "warn"
        else:
            level = "error"

    log_doc = {
        "auditId": context.audit_id,
        "message": f"[{test_name}] {message}",
        "timestamp": ts.isoformat(),
        "level": level,
        "meta": {
            "testName": test_name,
            "step": step,
        },
    }

    # 5. 写入 MongoDB audit_logs 集合
    context.db["audit_logs"].insert_one(log_doc)

    return condition
```

注意：

- 真实实现中需要考虑异常处理、批量写入或异步写入等细节；
- 为了保持原脚本风格，可将 Mongo 写入封装到独立的 helper 中，以便未来更换存储介质。

---

## 5. 与 `run_all_tests` 的配合与统计结果使用

在 `run_all_tests()` 中，可以通过 `AuditContext` 获得最终统计结果和时间信息，用于更新任务状态与写入报告。

### 5.1 运行入口示意

服务层在调用当前脚本时的示意代码：

```python
from pymongo import MongoClient


def run_audit(audit_id: str, firmware_zip: str) -> None:
    client = MongoClient("mongodb://...")
    db = client["firmware_audit"]

    context = AuditContext(
        audit_id=audit_id,
        db=db,
    )

    # 1. 更新 audits 集合，标记任务进入 ANALYZING
    db["audits"].update_one(
        {"id": audit_id},
        {
            "$set": {
                "status": "ANALYZING",
            }
        },
    )

    # 2. 调用原有 run_all_tests，内部各处 log_assert 将使用该 context
    run_all_tests(context)

    # 3. 根据 context.stats 与时间信息更新 audits/audit_reports
    finalize_audit(context)
```

其中 `run_all_tests(context)` 的签名可以在未来改造时调整为接受 `context` 参数，并在调用 `log_assert` 时传入 `context`。

### 5.2 汇总阶段写入任务与报告

`finalize_audit(context)` 的伪代码示意：

```python
from datetime import datetime, timezone


def finalize_audit(context: AuditContext) -> None:
    finished_at = datetime.now(timezone.utc)
    duration_ms = int((finished_at - context.started_at).total_seconds() * 1000)

    stats = context.stats

    # 1. 更新 audits 集合中的任务状态与汇总
    status = "COMPLETED" if stats.failed == 0 else "FAILED"

    context.db["audits"].update_one(
        {"id": context.audit_id},
        {
            "$set": {
                "status": status,
                "completedAt": finished_at.isoformat(),
                "summary": {
                    "total": stats.total,
                    "passed": stats.passed,
                    "warning": stats.warning,
                    "failed": stats.failed,
                    "durationMs": duration_ms,
                },
            }
        },
    )

    # 2. 写入 audit_reports 集合中的汇总信息（简化示意）
    report_doc = {
        "auditId": context.audit_id,
        "timestamp": finished_at.isoformat(),
        "overallScore": max(0, 100 - stats.failed * 5),
        # 其余字段（firmwareType/productName/version/checks/fileStructure/trend）
        # 后续在真正接入领域模型时填充
    }

    context.db["audit_reports"].update_one(
        {"auditId": context.audit_id},
        {"$set": report_doc},
        upsert=True,
    )
```

说明：

- 这里的评分与字段仅作示意，真实实现时应结合领域模型与 `InspectionReport` 的 schema；
- 核心是强调：统计结果从 `AuditContext.stats` 中获取，而不是重新解析日志文件。

---

## 6. 集成步骤（不立即修改代码的实施路线）

本设计文档的实施建议分为几步，便于控制风险：

1. **准备阶段**
   - 在后端服务层实现 Mongo 访问与 `AuditContext` 定义；
   - 在服务层调用当前脚本时，创建 `AuditContext` 并持有 `db` 与 `audit_id`。

2. **轻量改造 `run_all_tests` 签名**
   - 将 `run_all_tests()` 改造为可选接受 `context` 参数：
     - 若传入则在内部调用 `log_assert` 时附带 `context`；
     - 若不传入则行为与当前一致。

3. **增强 `log_assert` 实现**
   - 在不改变所有调用点的前提下，按照本设计文档更新 `log_assert`：
     - 保留原逻辑；
     - 若 `context` 不为 `None`，则更新统计并写入 Mongo ConsoleLog。

4. **接入任务与报告写入**
   - 在服务层调用 `run_all_tests(context)` 之后，调用 `finalize_audit(context)`；
   - 更新 `audits` 与 `audit_reports` 集合，供 `/audits/{id}` 与 `/audits/{id}/report` 使用。

5. **渐进增强**
   - 随着领域模型的演进，将更多结构化信息（如 `CheckItem`、`FileItem`）写入 `audit_reports`；
   - 可以在未来将 `log_assert` 进一步演化为直接生成 `CheckItem` 的工厂函数。

---

## 7. 小结

通过在 `log_assert` 与 `run_all_tests` 这两个统一出口处增加审计上下文与 Mongo 写入逻辑，可以在不大幅修改原始检查代码的前提下：

- 为每次审计任务完整记录 ConsoleLog 流（支撑 `/audits/{id}/logs`）；  
- 实时累积成功/告警/失败数量（支撑任务状态与报告统计）；  
- 为后续迁移到完全结构化的检查模型（`CheckItem` / `InspectionReport`）打下基础。  

本方案当前仅为设计文档，未直接修改任何现有代码，可在后续重构阶段按步骤逐步落地。 

