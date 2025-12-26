.PHONY: help install run test clean docker-build docker-run lint format

# 默认目标
help:
	@echo "可用命令:"
	@echo "  install      安装依赖"
	@echo "  run          运行开发服务器"
	@echo "  test         运行测试"
	@echo "  test-cov     运行测试并生成覆盖率报告"
	@echo  "  clean        清理缓存文件"
	@echo "  docker-build 构建 Docker 镜像"
	@echo "  docker-run   运行 Docker 容器"
	@echo "  docker-dev   运行开发环境 Docker"
	@echo "  lint         代码检查"
	@echo "  format       代码格式化"

# 安装依赖
install:
	pip install -r requirements.txt

# 运行开发服务器
run:
	uvicorn app.main:app --reload

# 运行测试
test:
	pytest

# 运行测试并生成覆盖率报告
test-cov:
	pytest --cov=app --cov-report=html --cov-report=term

# 清理缓存文件
clean:
	find . -type f -name "*.pyc" -delete
	find . -type d -name "__pycache__" -delete
	find . -type d -name "*.egg-info" -exec rm -rf {} +
	rm -rf build/
	rm -rf dist/
	rm -rf .pytest_cache/
	rm -rf .coverage
	rm -rf htmlcov/
	rm -f app.db
	rm -f test.db

# 构建 Docker 镜像
docker-build:
	docker build -t fastapi-template .

# 运行 Docker 容器
docker-run:
	docker-compose up -d

# 运行开发环境 Docker
docker-dev:
	docker-compose -f docker-compose.dev.yml up

# 代码检查
lint:
	flake8 app tests || echo "请安装 flake8: pip install flake8"

# 代码格式化
format:
	black app tests || echo "请安装 black: pip install black"

# 完整开发流程
dev: install run

# 构建和测试
build-test: clean test