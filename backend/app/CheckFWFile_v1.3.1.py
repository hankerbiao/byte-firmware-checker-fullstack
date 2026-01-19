#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import argparse
import zipfile
import stat
from typing import List, Dict, Set
import logging
import os
import tempfile
import shutil
import datetime
import hashlib
import re
import uuid
from PyPDF2 import PdfReader
import pdfplumber
from pymongo import MongoClient
MONGO_AVAILABLE = True


MONGO_CLIENT = None
MONGO_DB = None


# 全局变量声明
FIRMWARE_ZIP = None
MANUFACTURER = None
PRODUCT = None
FW_VERSION = None
FW_TYPE = None
root_dir = None
BMCtype = None
submit = None
script_dir = os.path.dirname(os.path.abspath(__file__))
current_time = datetime.datetime.now().strftime("%Y-%m-%d_%H:%M:%S")

# 构建日志文件的完整路径


def parse_args():
    description = (
        "解析固件包 ZIP 文件路径/目录正确性；\n"
        "======================== BMC 固件包树目录 ===============================\n"
        "[Manufacturer Name]_[ProductName]_BMC_[BMC Version].zip\n"
        "|--[Manufacturer Name]_[ProductName]_BMC_[BMC Version]/\n"
        "|  |--Tools/\n"
        "|  |  |--FruTools/\n"
        "|  |  |--UpdateTools/\n"
        "|  |  |  |--FW_Update_Tool_Release_Note.pdf\n"
        "|  |  |  |--FW_Update_Tool_User_Guide.pdf\n"
        "|  |  |--Others/\n"
        "|  |--Test Reports/\n"
        "|  |  |--[Manufacturer Name]_[Product Name]_[Current stage]_BMC_[BMC Version]_Pre-Test_Report.xlsx\n"
        "|  |  |--[Manufacturer Name]_[Product Name]_[Current stage]_BMC_[1st]_Full_Test_Report.xlsx\n"
        "|  |--[Manufacturer Name]_[Product Name]_BMC_[BMC Version].[ima, bin]\n"
        "|  |--[Manufacturer Name]_[Product Name]_BMC_[BMC Version].[hpm, tar]\n"
        "|  |--Release Note.pdf\n"
        "|  |--BMC_Compile_Note.txt #for AMI BMC\n"
        "|  |--BMC_Release_Guide.txt #for OpenBMC\n"
        "|  |--BMC Load Default Config.xlsx\n"
        "|  |--InbUpdateTool.zip\n"
        "|  |  |--[FW Update Tool]\n"
        "|  |  |--InbUpdate.sh\n"
        "|  |--OobUpdateTool.zip\n"
        "|  |  |--[FW Update Tool]\n"
        "|  |  |--OobUpdate.sh\n"

        "======================== BIOS 固件包树目录 ===============================\n"
        "[Manufacturer Name]_[ProductName]_BIOS_[BIOS Version].zip\n"
        "|--[Manufacturer Name]_[ProductName]_BIOS_[BIOS Version]/\n"
        "|  |--Tools/\n"
        "|  |  |--Inband/\n"
        "|  |  |  |--InbConfigBios.sh\n"
        "|  |  |  |--InbConfigBios_Guide.pdf\n"
        "|  |  |  |--[Inb Config tool]\n"
        "|  |  |--Outband/\n"
        "|  |  |  |--OobConfigBios.sh\n"
        "|  |  |  |--OobConfigBios_Guide.pdf\n"
        "|  |  |  |--[Oob Config tool]\n"
        "|  |--Test Report/\n"
        "|  |  |--[Manufacturer Name]_[Product Name]_[Current stage]_BIOS_[BIOS Version]_Pre-Test_Report.xlsx\n"
        "|  |  |--[Manufacturer Name]_[Product Name]_[Current stage]_BIOS_[1st]_Full_Test_Report.xlsx\n"
        "|  |--[Manufacturer Name]_[Product Name]_BIOS_[BIOS Version].[bin]\n"
        "|  |--[Manufacturer Name]_[Product Name]_BIOS_[BIOS Version].[hpm, tar]\n"
        "|  |--Release Note.pdf\n"
        "|  |--InbUpdateTool.zip\n"
        "|  |  |--Tools\n"
        "|  |  |  |--Inband\n"
        "|  |  |  |  |--[Inband FW Update Tool]\n"
        "|  |  |--InbUpdateBios.sh\n"
        "|  |  |--Inband_FW_Update_Tool_Release_Note.pdf\n"
        "|  |  |--Inband_FW_Update_Tool_User_Guide.pdf\n"
        "|  |--OobUpdateTool.zip\n"
        "|  |  |--Tools\n"
        "|  |  |  |--Outband\n"
        "|  |  |  |  |--[OOB FW Update Tool]\n"
        "|  |  |--OobUpdate.sh\n"
        "|  |  |--OOB_FW_Update_Tool_Release_Note.pdf\n"
        "|  |  |--OOB_FW_Update_Tool_User_Guide.pdf\n"
        
 
    )
    parser = argparse.ArgumentParser(description=description, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('-f', '--firmware', default='Changkuai_G220B-1G1BxxM_BMC_4.13.0b_验收日志.zip', help='固件 ZIP 文件路径')
    parser.add_argument('-t', '--BMCtype', choices=['AMI', 'OpenBMC', 'Self'], default='OpenBMC', help='BMC类型：默认OpenBMC; 用于校验BMC_Compile_Note、BMC_Release_Guide，自有框架填Self')
    parser.add_argument('-s', '--submit', action='store_true', help='固件是否首次提交（传入则校验报告文档）')
    parser.add_argument('-a', '--audit-id', help='外部传入的审计任务 ID，用于与服务端对齐')
    return parser.parse_args()

def extract_info_from_filename(filename):
    # 提取 MANUFACTURER, PRODUCT, FW_TYPE(BMC/BIOS等), FW_VERSION
    pattern = r'(?P<manufacturer>[^_]+)_(?P<product>[^_]+)_(?P<fw_type>BMC|BIOS)_(?P<version>[A-Za-z0-9\.-]+)'
    match = re.search(pattern, filename)
    if not match:
        raise ValueError(f"文件名格式不匹配预期模式: {filename}")

    return {
        'MANUFACTURER': match.group('manufacturer'),
        'PRODUCT': match.group('product'),
        'FW_TYPE': match.group('fw_type'),
        'FW_VERSION': match.group('version')
    }

def initialize_globals():
    global FIRMWARE_ZIP, MANUFACTURER, PRODUCT, FW_VERSION, FW_TYPE, root_dir, BMCtype, submit, AUDIT_ID

    args = parse_args()
    FIRMWARE_ZIP = args.firmware
    BMCtype = args.BMCtype
    submit = args.submit

    file_basename = os.path.basename(FIRMWARE_ZIP)
    file_root_name = os.path.splitext(file_basename)[0]

    try:
        info = extract_info_from_filename(file_basename)

        MANUFACTURER = info['MANUFACTURER']
        PRODUCT = info['PRODUCT']
        FW_TYPE = info['FW_TYPE']
        FW_VERSION = info['FW_VERSION'].strip().replace('.zip', '')
        root_dir = file_root_name
        if getattr(args, "audit_id", None):
            AUDIT_ID = args.audit_id
        else:
            AUDIT_ID = f"{root_dir}_{current_time}_{uuid.uuid4().hex[:8]}"

    except ValueError as e:
        print("错误：", e)
        exit(1)

def init_mongo():
    global MONGO_CLIENT, MONGO_DB
    if not MONGO_AVAILABLE:
        return
    if MONGO_CLIENT is not None:
        return
    MONGO_CLIENT = MongoClient("mongodb://10.17.154.252:27018")
    MONGO_DB = MONGO_CLIENT["firmware_audit"]


initialize_globals()
log_path = os.path.join(script_dir, 'logs')
os.makedirs(log_path, exist_ok=True)
log_file = os.path.join(log_path,f"{AUDIT_ID}.log")
STATS = {"total": 0, "passed": 0, "warning": 0, "failed": 0}
WORK_DIR_BASE = os.path.join(tempfile.gettempdir(), "fwcheck")
os.makedirs(WORK_DIR_BASE, exist_ok=True)
WORK_DIR = os.path.join(WORK_DIR_BASE, AUDIT_ID)
os.makedirs(WORK_DIR, exist_ok=True)
init_mongo()
BMCfirst_level_files = [
    f"{root_dir}/Tools",
    f"{root_dir}/TestReports",
    rf"r'{root_dir}/{root_dir}\.(ima|bin|ima_flasher|hpm|tar)'",  # 需处理多扩展名
    f"{root_dir}/BMC Load Default Config.xlsx",
    f"{root_dir}/Release Note.pdf",
    f"{root_dir}/InbUpdateTool.zip",
    f"{root_dir}/OobUpdateTool.zip"
]

BMCsecond_level_files = [
    f"{root_dir}/Tools/UpdateTools",
    f"{root_dir}/Tools/FruTools",
    rf"r'{root_dir}/TestReports/{MANUFACTURER}_{PRODUCT}_(EVT|DVT|PVT|Gray|MP)_BMC_{FW_VERSION}_Pre-Test_Report\.xlsx'"

]
BMCsecond_level_files_report = [
    rf"r'{root_dir}/TestReports/{MANUFACTURER}_{PRODUCT}_(EVT|DVT|PVT|Gray|MP)_BMC_(1st|2nd)_Full_Test_Report\.xlsx'"
]
BMCthird_level_files = [
    f"{root_dir}/Tools/UpdateTools/FW_Update_Tool_Release_Note.pdf",
    f"{root_dir}/Tools/UpdateTools/FW_Update_Tool_User_Guide.pdf"
]

BIOSfirst_level_files = [
    f"{root_dir}/Tools",
    f"{root_dir}/Setup",
    f"{root_dir}/TestReport",
    rf"r'{root_dir}/{root_dir}\.(ima|bin|hpm|tar|rom)'",  # 需处理多扩展名 
    f"{root_dir}/Release Note.pdf",
    f"{root_dir}/InbUpdateTool.zip",
    f"{root_dir}/OobUpdateTool.zip"
]

BIOSsecond_level_files = [
    f"{root_dir}/Tools/Inband",
    f"{root_dir}/Tools/Outband",
    rf"r'{root_dir}/TestReport/{MANUFACTURER}_{PRODUCT}_(EVT|DVT|PVT|Gray|MP)_BIOS_{FW_VERSION}_Pre-Test_Report\.xlsx'", 
    rf"r'{root_dir}/Setup/SetupLayout_{MANUFACTURER}_{PRODUCT}_BIOS_{FW_VERSION}\.xlsx'",
    rf"r'{root_dir}/Setup/SetupConfig_{MANUFACTURER}_{PRODUCT}_BIOS_{FW_VERSION}\.txt'"
]
BIOSsecond_level_files_report = [
    rf"r'{root_dir}/TestReport/{MANUFACTURER}_{PRODUCT}_(EVT|DVT|PVT|Gray|MP)_BIOS_(1st|2nd)_Full_Test_Report\.xlsx'"
]

BIOSthird_level_files = [
    f"{root_dir}/Tools/Inband/InbConfigBios.sh",
    f"{root_dir}/Tools/Inband/InbConfigBios_Guide.pdf",
    f"{root_dir}/Tools/Outband/OobConfigBios.sh",
    f"{root_dir}/Tools/Outband/OobConfigBios_Guide.pdf"
]
replace_map = {
    "MANUFACTURER": MANUFACTURER,
    "PRODUCT": PRODUCT,
    "FW_VERSION": FW_VERSION
}



# 配置日志记录器
def setup_logger(logger_name, log_file):
    """配置日志记录器，同时输出到文件和控制台"""
    # 获取日志器
    logger = logging.getLogger(logger_name)
    logger.setLevel(logging.INFO)
    
    # 清空已有处理器（避免重复记录）
    if logger.handlers:
        logger.handlers = []
    
    # 创建文件处理器
    file_handler = logging.FileHandler(log_file, encoding='utf-8')
    file_handler.setLevel(logging.INFO)
    
    # 设置日志格式
    formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
    file_handler.setFormatter(formatter)
    
    # 添加处理器到日志器
    logger.addHandler(file_handler)
    
    return logger

# 公共断言函数
def log_assert(
    condition: bool,
    message: str,
    logger_name: str,
    fail_level: int = logging.ERROR,
    category: str | None = None,
    check_name: str | None = None,
    standard: str | None = None,
) -> bool:
    logger = setup_logger(logger_name, log_file)
    level_name = logging.getLevelName(fail_level)
    if condition:
        text = f"[PASS] {message}"
        logger.info(text)
    else:
        text = f"[{level_name}] {message}"
        logger.log(fail_level, text)

    STATS["total"] += 1
    if condition:
        if fail_level == logging.WARNING:
            STATS["warning"] += 1
        else:
            STATS["passed"] += 1
    else:
        if fail_level == logging.WARNING:
            STATS["warning"] += 1
        else:
            STATS["failed"] += 1


    try:
        ts = datetime.datetime.now(datetime.timezone.utc).isoformat()
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

        doc = {
            "auditId": AUDIT_ID,
            "message": text,
            "timestamp": ts,
            "level": level,
            "meta": {
                "testName": logger_name,
            },
        }
        MONGO_DB["audit_logs"].insert_one(doc)

        if condition:
            if fail_level == logging.WARNING:
                check_status = "PASS"
            else:
                check_status = "PASS"
        else:
            if fail_level == logging.WARNING:
                check_status = "WARNING"
            else:
                check_status = "FAIL"

        check_doc = {
            "auditId": AUDIT_ID,
            "id": logger_name,
            "category": category,
            "name": check_name or logger_name,
            "status": check_status,
            "description": message,
            "standard": standard,
        }
        MONGO_DB["audit_checks"].insert_one(check_doc)
    except Exception as e:
        print(f"[Mongo] 写入 audit_logs/audit_checks 失败: {e}")

    return condition

def build_directory_tree(contents: List[str]) -> Dict[str, Set[str]]:
    """构建目录树结构"""
    tree = {}
    for item in contents:
        parts = item.rstrip('/').split('/')
        for i in range(len(parts)):
            parent_path = '/'.join(parts[:i])
            current_dir = parts[i]
            current_path = '/'.join(parts[:i+1]) if i > 0 else current_dir
            
            if parent_path not in tree:
                tree[parent_path] = set()
            tree[parent_path].add(current_dir)
            
            # 如果当前路径不是文件（不以/结尾且不是最后一级），添加到树中
            if i < len(parts) - 1 or item.endswith('/'):
                if current_path not in tree:
                    tree[current_path] = set()
    return tree

def print_zip_tree(zip_file: str, namelist, log_file) -> None:
    """以tree格式打印ZIP包的完整目录树"""
    contents = namelist
    
    if not contents:
        print("ZIP文件为空或无法读取")
        return
    
    tree = build_directory_tree(contents)
    
    def print_subtree(path: str, prefix: str = ""):
        """递归打印子目录树"""
        items = sorted(tree.get(path, set()))
        for i, item in enumerate(items):
            is_last = i == len(items) - 1
            item_prefix = "└── " if is_last else "├── "
            item_path = f"{path}/{item}" if path else item
            
            # 区分目录和文件（目录以/结尾）
            display_name = f"{item}/" if item_path in tree else item
            with open(log_file, 'a', encoding='utf-8') as z:
                z.write(f"{prefix}{item_prefix}{display_name}\n")
            
            # 如果是目录，递归打印子目录
            if item_path in tree:
                sub_prefix = "    " if is_last else "│   "
                print_subtree(item_path, prefix + sub_prefix)
    
    print_subtree("")

def clean_string(s):
    """清理字符串，去除首尾空格和不可见字符"""
    return s.strip()

def escape_version(version):
    """正确转义版本号中的特殊字符"""
    # 先去除首尾空格
    version = version.strip()
    # 转义所有正则表达式特殊字符
    special_chars = r'.^$*+?{}[]\|()'
    for char in special_chars:
        version = version.replace(char, f'\\{char}')
    return version
    
def test_firmware_naming():
    """BMC-1-1 固件整包命名检查"""
    # 步骤 1: 解析固件包路径，获取文件名和测试用例名称
    firmware_name = os.path.basename(FIRMWARE_ZIP)
    test_name = test_firmware_naming.__name__

    # 步骤 2: 清理输入参数，去除厂商/产品/固件类型/版本号两端空格
    clean_manufacturer = MANUFACTURER.strip()
    clean_product = PRODUCT.strip()
    clean_fw_type = FW_TYPE.strip()
    clean_version = FW_VERSION.strip()
    
    # 步骤 3: 构造预期的固件包命名正则表达式（厂商_产品_类型_版本.zip）
    escaped_version = clean_version.replace('.', r'\.')
    expected_pattern = fr'^{clean_manufacturer}_{clean_product}_{clean_fw_type}_{escaped_version}\.zip$'
    
    # 步骤 4: 使用正则表达式对固件包文件名执行匹配
    match = re.match(expected_pattern, firmware_name, re.IGNORECASE)

    checks = [
        # 步骤 5: 检查固件包命名是否符合规范且扩展名为 .zip
        log_assert(
            match is not None,
            f"命名符合规范:{firmware_name}:{MANUFACTURER}_{PRODUCT}_{FW_TYPE}_{FW_VERSION}",
            test_name,
            category="fw 文件命名规范"
        ),
        log_assert(
            FIRMWARE_ZIP.endswith('.zip'),
            "是ZIP格式文件",
            test_name,
            category="扩展名.zip 命名规范"
        )
    ]
    # 步骤 6: 解压固件包，逐个检查内部文件名是否全部为英文（ASCII）
    try:
        with zipfile.ZipFile(FIRMWARE_ZIP, 'r') as zf:
            for name in zf.namelist():
                checks.append(
                    log_assert(
                        all(c.isascii() for c in name),
                        f"文件名使用英文: {name}",
                        test_name,
                        category="目录结构全部为英文"
                    )
                )
    except Exception as e:
        checks.append(
            log_assert(
                False,
                f"检查文件文件名含中文: {str(e)}",
                test_name,
                category="目录结构全部为英文"
            )
        )
    
    return all(checks)

def test_files_in_zip(zip_path):
    test_name = test_files_in_zip.__name__
    checks = []

    # 步骤 7: 打开固件 ZIP 包，准备检查根目录及编译说明文件
    with zipfile.ZipFile(zip_path, 'r') as zip_ref:
        # 步骤 8: 检查是否存在预期的根目录 root_dir
        root_dir_exists = any(
            name == f"{root_dir}/" or name.startswith(f"{root_dir}/") 
            for name in zip_ref.namelist()
        )
        checks.append(
            log_assert(
                root_dir_exists,
                f"检查根目录:{root_dir}",
                test_name,
                category="存在预期的根目录 root_dir"
            )
        )
        # 步骤 9: 对 BMC 固件，根据 BMCtype 检查对应编译说明文件是否存在
        if FW_TYPE == "BMC":
            if BMCtype == "AMI":
                has_ami = any(name.endswith(("BMC_Compile_Note.txt")) for name in zip_ref.namelist())
                checks.append(
                    log_assert(
                        has_ami,
                        f"检查编译文件文件(for AMI)：BMC_Compile_Note.txt",
                        test_name,
                        category="对应编译说明文件"
                    )
                )
            elif BMCtype == "OpenBMC":
                has_ami = any(name.endswith(("BMC_Release_Guide.txt")) for name in zip_ref.namelist())
                checks.append(
                    log_assert(
                        has_ami,
                        f"检查编译文件文件(for Open BMC)：BMC_Release_Guide.txt",
                        test_name,
                        category="对应编译说明文件"
                    )
                )
            else:
                checks.append(
                    log_assert(
                        True,
                        f"自有框架没有编译文件",
                        test_name
                    )
                )   
                
    return all(checks)


def test_paths_in_zip(zip_path, path_patterns, replace_map=None, fileC="", fail_level=logging.ERROR):
    """
    检查 ZIP 文件中是否包含指定路径列表（支持正则）。
    
    :param zip_path: ZIP 文件路径
    :param path_patterns: 要检查的路径列表，可以是普通字符串或正则表达式（以 r'...' 表示）
    :param replace_map: 字典，用于替换路径模板中的变量，如 {MANUFACTURER: "Dell", ...}
    :return: (found_items, missing_items)
    """
    test_name = test_paths_in_zip.__name__
    missing_items = []
    checks = []

    # 步骤 10: 打开固件 ZIP 包并缓存所有条目名称用于后续路径匹配
    with zipfile.ZipFile(zip_path, 'r') as zip_ref:
        zip_contents = set(zip_ref.namelist())

    # 步骤 11: 根据 replace_map 对路径模板中的变量（如厂商/产品）进行替换
    if replace_map:
        replaced_patterns = []
        for pattern in path_patterns:
            for key, value in replace_map.items():
                pattern = pattern.replace(f"{{{key}}}", re.escape(value))
            replaced_patterns.append(pattern)
        path_patterns = replaced_patterns
    
    # 步骤 12: 收集 ZIP 中实际存在的 OobConfigBios 文件，用于后续必选/可选判断
    oob_files_in_zip = [item for item in zip_contents if 'OobConfigBios' in item]

    # 步骤 13: 遍历每个预期路径/模式，按规则决定是否需要检查
    for pattern in path_patterns:
        is_full_test_report = '_Full_Test_Report' in pattern
        skip_check = is_full_test_report and not submit
        
        if skip_check:
            # 当 submit=False 时，跳过 _Full_Test_Report 路径的强制检查，仅记录警告
            continue
        
        matched = False
        is_regex = isinstance(pattern, str) and (pattern.startswith("r'") or pattern.startswith('r"'))

        if is_regex:
            # 步骤 14: 将原始字符串解析为正则表达式，在 ZIP 条目中按模式匹配
            try:
                regex_pattern = eval(pattern)  # 将 r'xxx' 转为原始字符串
                regex = re.compile(regex_pattern)
                for item in zip_contents:
                    if regex.search(item): 
                        matched = True
                        checks.append(
                            log_assert(
                                True,
                                f"检查层级目录{fileC}: {pattern}",
                                test_name,
                                fail_level=fail_level,
                                category="层级目录"
                            )
                        )
                        break
            except Exception as e:
                print(f"[ERROR] 正则解析失败: {pattern}, 错误: {e}")
        else:
            # 步骤 15: 按普通路径字符串结尾进行匹配，判断是否存在对应文件/目录
            if any(item.rstrip('/').endswith(pattern.rstrip('/')) for item in zip_contents):
                matched = True
                checks.append(
                    log_assert(
                        True,
                        f"检查层级目录{fileC}: {pattern}",
                        test_name,
                        fail_level=fail_level,
                        category="层级目录"
                    )
                )

        if not matched:
            # 步骤 16: 对未匹配路径，区分 OobConfigBios 可选项与必选项并记录结果
            if 'OobConfigBios' in pattern and not oob_files_in_zip:
                # 记录警告而非错误
                checks.append(log_assert(False, f"非必须文件不存在: {pattern}", test_name, fail_level=logging.WARNING, category="目录结构"))
            else:
                # 其他情况正常处理
                missing_items.append(pattern)
                checks.append(log_assert(False, f"检查层级目录{fileC}: {pattern}", test_name, fail_level=fail_level, category="目录结构"))
           
    return all(checks)

def check_extracts_to_current_dir(zip_file_path):
    """
    检查ZIP文件解压后是否会释放到当前目录
    """
    with zipfile.ZipFile(zip_file_path, 'r') as zf:
        top_level_entries = set()
        
        for name in zf.namelist():
            # 获取路径的第一部分（顶级目录/文件）
            parts = name.split('/')
            if parts and parts[0]:
                top_level_entries.add(parts[0])
        
        # 如果有多个顶级条目，或者顶级条目包含文件而非目录，则会释放到当前目录
        return len(top_level_entries) > 1 or any('.' in entry for entry in top_level_entries)


def test_operation_tool():
    """BMC-1-3 固件整包运维工具检查"""
    # 步骤 17: 为每个运维工具定义需要检查的脚本和文档
    tool_configs = {
        "InbUpdateTool": {
            "BMC": {
                "scripts": {'InbUpdate.sh'},
                "docs": set()  # BMC类型不检查文档
            },
            "BIOS": {
                "scripts": {'InbUpdateBios.sh'},
                "docs": {
                    'Inband_FW_Update_Tool_User_Guide.pdf',
                    'Inband_FW_Update_Tool_Release_Note.pdf'
                }
            }
        },
        "OobUpdateTool": {
            "BMC": {
                "scripts": {'OobUpdate.sh'},
                "docs": set()  # BMC类型不检查文档
            },
            "BIOS": {
                "scripts": {'OobUpdate.sh'},
                "docs": {
                    'OOB_FW_Update_Tool_Release_Note.pdf',
                    'OOB_FW_Update_Tool_User_Guide.pdf'
                }
            }
        }
    }
    
    test_name = test_operation_tool.__name__
    checks = []
    
    # 步骤 18: 打开整包固件 ZIP，遍历每一个运维工具子包
    with zipfile.ZipFile(FIRMWARE_ZIP, 'r') as zf:
        for tool in tool_configs.keys():
            zip_path = f"{root_dir}/{tool}.zip"
            
            # 步骤 19: 检查运维工具 ZIP 包是否存在于固件根目录
            checks.append(
                log_assert(
                    zip_path in zf.namelist(),
                    f"检查运维工具包存在性: {zip_path}",
                    test_name,
                    category="运维工具"
                )
            )
            
            # 跳过不存在的工具包
            if zip_path not in zf.namelist():
                continue
            
            # 步骤 20: 将工具 ZIP 写入临时文件，为后续解压及检查做准备
            with tempfile.NamedTemporaryFile(delete=False, suffix='.zip') as temp_file:
                temp_path = temp_file.name
                temp_file.write(zf.read(zip_path))
            
            with zf.open(zip_path) as tool_zip:
                with zipfile.ZipFile(tool_zip) as tz:
                    # 步骤 21: 检查工具 ZIP 解压后是否直接释放在当前目录
                    extracts_to_current = check_extracts_to_current_dir(temp_path)
                    checks.append(
                        log_assert(
                            extracts_to_current,
                            f"运维工具解压路径检查: {tool}.zip 解压到当前目录",
                            test_name,
                            category="运维工具"
                        )
                    )
                    
                    # 步骤 22: 根据 FW_TYPE 获取当前工具的检查配置（脚本及文档）
                    config = tool_configs[tool][FW_TYPE]
                    required_files = config["scripts"].union(config["docs"])
                    
                    # 步骤 23: 如果解压到当前目录，逐个检查每个必需文件是否存在
                    if extracts_to_current:
                        for file in required_files:
                            file_exists = file in tz.namelist()
                            checks.append(
                                log_assert(
                                    file_exists,
                                    f"运维工具文件检查: {tool}.zip 应包含文件 {file}",
                                    test_name,
                                    category="运维工具"
                                )
                            )
                    else:
                        # 如果解压到子目录，所有文件检查失败
                        for file in required_files:
                            checks.append(
                                log_assert(
                                    False,
                                    f"运维工具文件检查: {tool}.zip 应解压到当前目录以包含文件 {file}",
                                    test_name,
                                    category="运维工具"
                                )
                            )
                    
                    # 步骤 24: 对所有脚本文件检查执行权限（仅脚本，不检查文档）
                    if extracts_to_current:
                        for script in config["scripts"]:
                            if script in tz.namelist():
                                st_mode = tz.getinfo(script).external_attr >> 16
                                checks.append(
                                    log_assert(
                                        st_mode & (stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH),
                                        f"运维工具权限检查: {script} (权限: {oct(st_mode)})",
                                        test_name,
                                        category="运维工具"
                                    )
                                )
                os.unlink(temp_path)  # 清理临时文件
    return all(checks)

def calculate_md5(file_path):
    """计算文件的MD5值"""
    md5 = hashlib.md5()
    with open(file_path, "rb") as f:
        for chunk in iter(lambda: f.read(4096), b""):
            md5.update(chunk)
    return md5.hexdigest()

def find_md5_in_pdf(pdf_path, target_md5):
    """在PDF中查找MD5值并返回包含该行和上一行的内容"""
    try:
        with open(pdf_path, 'rb') as file:
            reader = PdfReader(file)
            lines = []
            for page in reader.pages:
                page_text = page.extract_text()
                # 按行分割并清理空白行
                page_lines = [line.strip() for line in page_text.split('\n') if line.strip()]
                lines.extend(page_lines)
            
            # 查找包含MD5的行及其上一行
            results = []
            for i, line in enumerate(lines):
                if target_md5.lower() in line.lower() or f"0x{target_md5.lower()}" in line.lower():
                    prev_line = lines[i-1] if i > 0 else ""
                    results.append({
                        "previous_line": prev_line,
                        "matching_line": line
                    })
            return results
    except Exception as e:
        print(f"Error reading PDF: {e}")
        return []


def search_md5_in_pdf_with_pypdf2(pdf_path, target_str):
    try:
        with pdfplumber.open(pdf_path) as pdf:
            pdf_text = ""
            for page in pdf.pages:
                # 3.1 提取页面普通文本（非表格区域）
                page_plain_text = page.extract_text() or ""
                pdf_text += page_plain_text + "\n"  # 加换行分隔，避免内容粘连

                # 3.2 提取页面所有表格，拼接单元格内容
                tables = page.extract_tables()  # 提取所有表格（返回二维列表）
                for table in tables:
                    # 遍历表格的每一行
                    for row in table:
                        # 遍历行内每个单元格，过滤空值，拼接内容
                        row_text = " ".join([str(cell).strip() for cell in row if cell is not None])
                        pdf_text += row_text + "\n"  # 行内内容拼接后加换行

        # 4. 文本清洗（去空白、统一小写，避免格式干扰匹配）
        clean_pdf_text = pdf_text.lower().replace(" ", "").replace("\n", "").replace("\t", "")
        clean_target = target_str.lower().replace(" ", "").replace("\n", "").replace("\t", "")
        
        if clean_target in clean_pdf_text:
            return True
        return False
    except Exception as e:
        logging.error(f"PDF读取异常：{str(e)}")




def search_md5_in_pdf_with_pypdf2_old(pdf_path: str, target_md5: str) -> bool:
    """
    使用PyPDF2的PdfReader查找PDF（含表格）中的MD5值，匹配返回True，否则False
    
    Args:
        pdf_path: PDF文件路径
        target_md5: 32位MD5值
    
    Returns:
        bool: 匹配结果
    
    Raises:
        ValueError: MD5格式错误、PDF读取失败
        FileNotFoundError: PDF文件不存在
    """
    # 1. 校验MD5格式
    if not isinstance(target_md5, str) or len(target_md5) != 32:
        raise ValueError("目标MD5值格式错误（需为32位十六进制字符串）")
    target_md5_lower = target_md5.lower()

    # 2. 校验文件存在性
    if not os.path.exists(pdf_path):
        raise FileNotFoundError(f"PDF文件不存在：{pdf_path}")

    # 3. 读取PDF并查找MD5
    try:
        # PyPDF2的PdfReader初始化
        reader = PdfReader(pdf_path)
        total_pages = len(reader.pages)
        # print(f"开始遍历PDF（PyPDF2），总页数：{total_pages}")

        for page_num in range(total_pages):
            page = reader.pages[page_num]
            current_page_num = page_num + 1

            # 提取当前页文本（PyPDF2的文本提取方法）
            page_text = page.extract_text() or ""
            page_text_clean = page_text.replace(" ", "").replace("\n", "").replace("\t", "")
            page_text_lower = page_text_clean.lower()
            print(f"目标MD5: {target_md5_lower}")
            print(page_text_lower)
            # 检查MD5是否存在
            if target_md5_lower in page_text_lower:
                return True

        # 遍历完所有页面未匹配
        return False

    except Exception as e:
        raise ValueError(f"读取PDF失败：{str(e)}") from e

def test_images_md5_zip(zip_file_path):
    test_name = test_images_md5_zip.__name__
    checks = []
    """验证zip包中.bin和.hpm/.tar文件的MD5值并在PDF中查找"""
    # 步骤 30: 打开固件 ZIP 包并获取所有文件列表
    with zipfile.ZipFile(zip_file_path, 'r') as zip_ref:
        # 获取zip包内的所有文件
        all_files = zip_ref.namelist()
        
        # 步骤 31: 自动识别包含 Release Note.pdf 的子目录名称
        subdir_name = None
        for file in all_files:
            if "Release Note.pdf" in file:
                subdir_name = file.split("/")[0]
                break
        
        if not subdir_name:
            checks.append(log_assert(False,f"固件包未找到 Release Note.pdf 文件,Image MD5检查失败",test_name, category="MD5一致性"))
        
        # 步骤 32: 提取 Release Note.pdf 以便后续进行 MD5 匹配
        pdf_path = f"{subdir_name}/Release Note.pdf"
        if pdf_path in zip_ref.namelist():
            extracted_pdf_path = zip_ref.extract(pdf_path, path=WORK_DIR)
        
            # 步骤 33: 获取子目录下一层级的所有内容，作为候选映像文件列表
            first_level_contents = [f for f in all_files if f.startswith(f"{subdir_name}/") and len(f.split('/')) == 2]
        
            # 步骤 34: 筛选并处理 .bin/.ima/.rom 文件，计算 MD5 并在 PDF 中匹配
            bin_files = [f for f in first_level_contents if f.lower().endswith(('.bin', '.ima', '.rom'))]
            if bin_files:
                bin_file = bin_files[0]
                extracted_bin_path = zip_ref.extract(bin_file, path=WORK_DIR)
                actual_bin_md5 = calculate_md5(extracted_bin_path)

                matches = search_md5_in_pdf_with_pypdf2(extracted_pdf_path, actual_bin_md5)
                checks.append(log_assert(matches, f"{bin_files} MD5匹配结果{matches}", test_name, category="MD5一致性"))

            else:
                checks.append(log_assert(False,f"固件包未找到.bin或.ima或.rom后缀的文件",test_name, category="MD5一致性"))
        
            # 步骤 35: 筛选并处理 .hpm/.tar/.ima_flasher 文件，计算 MD5 并在 PDF 中匹配
            hpm_tar_files = [f for f in first_level_contents if f.lower().endswith(('.hpm', '.tar', '.ima_flasher'))]
            if hpm_tar_files:
                hpm_tar_file = hpm_tar_files[0]
                extracted_hpm_tar_path = zip_ref.extract(hpm_tar_file, path=WORK_DIR)
                actual_hpm_tar_md5 = calculate_md5(extracted_hpm_tar_path)

                matches = search_md5_in_pdf_with_pypdf2(extracted_pdf_path, actual_hpm_tar_md5)
                checks.append(log_assert(matches, f"{hpm_tar_file} MD5匹配结果{matches}", test_name, category="MD5一致性"))
            else:
                checks.append(log_assert(False,f"固件包未找到.hpm或.tar或.ima_flasher后缀的文件",test_name, category="MD5一致性"))


    return all(checks)

def test_flashtool_md5_zip():
    # 步骤 25: 定义需要校验 MD5 的运维工具包名称列表
    tools = ["InbUpdateTool", "OobUpdateTool"]
    test_name = test_flashtool_md5_zip.__name__
    checks = []
    # 步骤 26: 打开固件 ZIP，遍历每个工具包并构造 ZIP 与 Release Note 路径
    with zipfile.ZipFile(FIRMWARE_ZIP, 'r') as zf:
        for tool in tools:
            zip_path = f"{root_dir}/{tool}.zip"
            pdf_path = f"{root_dir}/Release Note.pdf"
            if pdf_path in zf.namelist():
                if zip_path in zf.namelist():
                    try:
                        # 步骤 27: 提取运维工具 ZIP 与 Release Note.pdf 到本地
                        extracted_tool_path = zf.extract(zip_path, path=WORK_DIR)
                        extracted_pdf_path = zf.extract(pdf_path, path=WORK_DIR)
                        # 步骤 28: 计算工具 ZIP 的 MD5 并在 Release Note.pdf 中查找匹配
                        actual_tool_md5 = calculate_md5(extracted_tool_path)
                        matches = search_md5_in_pdf_with_pypdf2(extracted_pdf_path, actual_tool_md5)
                        checks.append(log_assert(matches, f"{tool} MD5匹配结果{matches}", test_name, category="MD5一致性"))
                    except Exception as e:
                        raise ValueError(f"处理{tool}时失败：{str(e)}") from e
            else:
                # 步骤 29: 若缺少 Release Note.pdf，则记录当前工具 MD5 校验失败
                checks.append(log_assert(False,f"固件包未找到{pdf_path}文件,UpdateTool MD5检查失败",test_name, category="MD5一致性"))


    return all(checks)



def run_all_tests() -> None:
    # 使用字典管理每个测试函数及其参数
    if FW_TYPE == "BMC":
        first_level_files = BMCfirst_level_files
        second_level_files = BMCsecond_level_files
        second_level_files_report = BMCsecond_level_files_report
        third_level_files = BMCthird_level_files
    else:
        first_level_files = BIOSfirst_level_files
        second_level_files = BIOSsecond_level_files
        second_level_files_report = BIOSsecond_level_files_report
        third_level_files = BIOSthird_level_files

    test_configs = {
        test_firmware_naming: {},
        test_files_in_zip: {
            "args": (FIRMWARE_ZIP,)
        },
        test_paths_in_zip: [
            {
                "args": (FIRMWARE_ZIP, first_level_files, replace_map, "一")
            },

            {
                "args": (FIRMWARE_ZIP, second_level_files, replace_map, "二")
            },
            {
                "args": (FIRMWARE_ZIP, second_level_files_report, replace_map, "二", logging.WARNING)
            },
            {
                "args": (FIRMWARE_ZIP, third_level_files, replace_map, "三")
            }
        ],
        test_operation_tool: {},
        test_flashtool_md5_zip: {},
        test_images_md5_zip: {
            "args": (FIRMWARE_ZIP,)
        },
        
    }
    
    for test_func, config in test_configs.items():
        test_name = test_func.__name__
        
        try:
            if isinstance(config, list):
                # 处理需要多次调用的函数
                for i, sub_config in enumerate(config):
                    test_func(*sub_config["args"])
            else:
                # 处理单次调用的函数
                args = config.get("args", ())
                test_func(*args)
                
        except Exception as e:
            print(f"ERROR: 测试 {test_name} 异常: {str(e)}")
    with open(log_file, 'r', encoding='utf-8') as f:
        log_content = f.read()

    log_lines = log_content.splitlines()
    total = log_content.count("[PASS]") + log_content.count("[WARNING]") + log_content.count("[ERROR]")
    failed_count = log_content.count("[ERROR]")
    passed_count = total - failed_count
    error_line = [line for line in log_lines if 'ERROR' in line and '[ERROR]' in line]
    warning_lines = [line for line in log_lines if 'WARNING' in line and '[WARNING]' in line]
    # 输出汇总结果
    print("==================== 测试汇总 ======================\n")
    print(f"MANUFACTURER:{MANUFACTURER} ")
    print(f"PRODUCT:{PRODUCT} ")
    print(f"FW_VERSION:{FW_VERSION} ")
    print(f"ZIP File:{os.path.basename(FIRMWARE_ZIP)} \n")
    print(f"测试汇总: 总计 {total} 个, 通过 {passed_count} 个, 失败 {failed_count} 个;\nlog:{log_file}\n")
    if failed_count > 0:
        print("==================== 测试结果 Failed=================")
        for line in warning_lines:
            print(f"告警信息：{line}")
        for line in error_line:
            print(f"告警信息：{line}")
        
    else:
        print("==================== 测试结果 Passed=================")
        for line in warning_lines:
            print(f"告警信息：{line}")

def finalize_audit() -> None:
    if MONGO_DB is None:
        print("[Mongo] finalize_audit 跳过：MONGO_DB 为空")
        return
    try:
        finished_at = datetime.datetime.now(datetime.timezone.utc).isoformat()
        failed = STATS.get("failed", 0)
        status = "COMPLETED"
        if failed > 0:
            status = "FAILED"
        doc = {
            "id": AUDIT_ID,
            "status": status,
            "createdAt": current_time,
            "completedAt": finished_at,
            "firmwareType": FW_TYPE,
            "productName": PRODUCT,
            "version": FW_VERSION,
            "summary": {
                "total": STATS.get("total", 0),
                "passed": STATS.get("passed", 0),
                "warning": STATS.get("warning", 0),
                "failed": STATS.get("failed", 0),
            },
        }
        MONGO_DB["audits"].update_one({"id": AUDIT_ID}, {"$set": doc}, upsert=True)
    except Exception as e:
        print(f"[Mongo] 写入 audits 失败: {e}")
if __name__ == "__main__":
    try:
        with zipfile.ZipFile(FIRMWARE_ZIP, 'r') as zf:
            namelist = zf.namelist()
            run_all_tests()
            print_zip_tree(FIRMWARE_ZIP, namelist, log_file)
            finalize_audit()
    except Exception as e:
        print(f"无法读取ZIP文件: {e}")
    finally:
        try:
            shutil.rmtree(WORK_DIR, ignore_errors=True)
        except Exception:
            pass
