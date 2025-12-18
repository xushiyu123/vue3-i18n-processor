#!/bin/bash

# 批量国际化处理脚本 - 快速开始
# 使用方法: bash quick-start.sh

echo "🚀 批量国际化处理脚本 - 快速开始"
echo "=================================="

# 检查 Node.js 是否安装
if ! command -v node &> /dev/null; then
    echo "❌ 错误: 请先安装 Node.js (>=14.0.0)"
    exit 1
fi

echo "✓ Node.js 版本: $(node --version)"

# 进入脚本目录
cd "$(dirname "$0")"

# 显示帮助信息
echo ""
echo "📖 使用帮助:"
node batch-i18n-processor.js --help

echo ""
echo "🔍 常用命令示例:"
echo ""
echo "1. 模拟运行（推荐先执行）："
echo "   node batch-i18n-processor.js ../src/views --dry-run"
echo ""
echo "2. 处理 views 文件夹："
echo "   node batch-i18n-processor.js ../src/views"
echo ""
echo "3. 处理 components 文件夹："
echo "   node batch-i18n-processor.js ../src/components"
echo ""
echo "4. 处理整个 src 目录："
echo "   node batch-i18n-processor.js ../src"
echo ""
echo "5. 只处理 Vue template，输出到指定文件："
echo "   node batch-i18n-processor.js ../src --no-script --no-ts --output ./template-i18n.json"
echo ""

# 交互式选择
echo "🛠️  快速操作选择:"
echo "1) 模拟运行 ../src/views 文件夹"
echo "2) 实际处理 ../src/views 文件夹"  
echo "3) 模拟运行 ../src/components 文件夹"
echo "4) 实际处理 ../src/components 文件夹"
echo "5) 自定义命令"
echo "6) 退出"
echo ""

read -p "请选择操作 (1-6): " choice

case $choice in
    1)
        echo "执行: node batch-i18n-processor.js ../src/views --dry-run"
        node batch-i18n-processor.js ../src/views --dry-run
        ;;
    2)
        echo "⚠️  这将修改文件，请确保已备份代码！"
        read -p "确认继续？(y/N): " confirm
        if [[ $confirm =~ ^[Yy]$ ]]; then
            echo "执行: node batch-i18n-processor.js ../src/views"
            node batch-i18n-processor.js ../src/views
        else
            echo "已取消操作"
        fi
        ;;
    3)
        echo "执行: node batch-i18n-processor.js ../src/components --dry-run"
        node batch-i18n-processor.js ../src/components --dry-run
        ;;
    4)
        echo "⚠️  这将修改文件，请确保已备份代码！"
        read -p "确认继续？(y/N): " confirm
        if [[ $confirm =~ ^[Yy]$ ]]; then
            echo "执行: node batch-i18n-processor.js ../src/components"
            node batch-i18n-processor.js ../src/components
        else
            echo "已取消操作"
        fi
        ;;
    5)
        read -p "请输入自定义命令: node batch-i18n-processor.js " custom_args
        echo "执行: node batch-i18n-processor.js $custom_args"
        node batch-i18n-processor.js $custom_args
        ;;
    6)
        echo "退出"
        exit 0
        ;;
    *)
        echo "无效选择"
        exit 1
        ;;
esac

echo ""
echo "✅ 操作完成！"
echo ""
echo "📋 后续步骤:"
echo "1. 检查生成的 i18n-mapping.json 文件"
echo "2. 将映射添加到你的 i18n 配置中"
echo "3. 测试修改后的文件是否正常工作"
echo "4. 运行代码格式化工具"
