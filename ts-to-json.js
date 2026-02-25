#!/usr/bin/env node

/**
 * TypeScript 对象转 JSON 脚本
 * 使用方法: node ts-to-json.js <ts-file> [options]
 *
 * 参数:
 *   ts-file: TypeScript 文件路径
 *
 * 选项:
 *   --output <path>: JSON 输出文件路径 (默认: 与 TS 同名的 .json 文件)
 *   --help: 显示帮助信息
 *
 * 示例:
 *   node ts-to-json.js ./mgec.ts
 *   node ts-to-json.js ./mgec.ts --output ./output.json
 */

const fs = require('fs');
const path = require('path');

/**
 * 解析命令行参数
 */
function parseArgs() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help')) {
    console.log(`
使用方法: node ts-to-json.js <ts-file> [options]

参数:
  ts-file: TypeScript 文件路径

选项:
  --output <path>: JSON 输出文件路径 (默认: 与 TS 同名的 .json 文件)
  --help: 显示帮助信息

示例:
  node ts-to-json.js ./mgec.ts
  node ts-to-json.js ./mgec.ts --output ./output.json
`);
    process.exit(0);
  }

  const config = {
    tsFile: args[0],
    outputFile: null,
  };

  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case '--output':
        config.outputFile = args[++i];
        break;
      default:
        if (arg.startsWith('--')) {
          console.error(`未知选项: ${arg}`);
          process.exit(1);
        }
    }
  }

  // 如果没有指定输出文件，使用与 TS 同名的 .json 文件
  if (!config.outputFile) {
    const tsPath = path.parse(config.tsFile);
    config.outputFile = path.join(tsPath.dir, tsPath.name + '.json');
  }

  return config;
}

/**
 * 读取 TypeScript 文件
 */
function readTsFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      console.error(`❌ 错误: 文件不存在 - ${filePath}`);
      process.exit(1);
    }

    return fs.readFileSync(filePath, 'utf-8');
  } catch (error) {
    console.error(`❌ 读取文件失败: ${error.message}`);
    process.exit(1);
  }
}

/**
 * 解析 TypeScript export default 对象
 */
function parseExportDefault(content) {
  try {
    // 移除注释
    let cleanContent = content
      .replace(/\/\/.*$/gm, '') // 单行注释
      .replace(/\/\*[\s\S]*?\*\//g, ''); // 多行注释

    // 查找 export default 对象
    const exportMatch = cleanContent.match(/export\s+default\s*\{([\s\S]*)\};?\s*$/);

    if (!exportMatch) {
      console.error('❌ 错误: 未找到 export default 对象');
      process.exit(1);
    }

    // 提取对象内容
    const objectContent = exportMatch[1];

    // 解析键值对
    const result = {};

    // 匹配所有键值对，支持多种格式
    // 格式1: key: 'value',
    // 格式2: 'key': 'value',
    // 格式3: "key": "value",
    const keyValueRegex = /(['"]?)([^'":\n]+)\1\s*:\s*(['"`])([^\3]*?)\3\s*,?/g;

    let match;
    while ((match = keyValueRegex.exec(objectContent)) !== null) {
      const key = match[2].trim();
      const value = match[4];
      result[key] = value;
    }

    // 检查是否成功解析
    if (Object.keys(result).length === 0) {
      console.error('❌ 错误: 无法解析对象内容');
      process.exit(1);
    }

    return result;
  } catch (error) {
    console.error(`❌ 解析失败: ${error.message}`);
    process.exit(1);
  }
}

/**
 * 主函数
 */
function main() {
  try {
    const config = parseArgs();

    console.log('🔄 开始转换 TypeScript 到 JSON...\n');
    console.log('配置:', {
      输入文件: config.tsFile,
      输出文件: config.outputFile,
    });
    console.log('');

    // 读取 TypeScript 文件
    const tsContent = readTsFile(config.tsFile);

    // 解析 export default 对象
    const jsonData = parseExportDefault(tsContent);
    const entryCount = Object.keys(jsonData).length;
    console.log(`✓ 解析成功 (${entryCount} 条数据)\n`);

    // 确保输出目录存在
    const outputDir = path.dirname(config.outputFile);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // 写入 JSON 文件
    const jsonContent = JSON.stringify(jsonData, null, 2);
    fs.writeFileSync(config.outputFile, jsonContent, 'utf-8');

    console.log('✅ 转换成功！');
    console.log(`📁 输出文件: ${path.resolve(config.outputFile)}`);
    console.log(`📝 数据条数: ${entryCount}`);
  } catch (error) {
    console.error('❌ 转换失败:', error.message);
    process.exit(1);
  }
}

// 运行脚本
if (require.main === module) {
  main();
}

module.exports = {
  parseExportDefault,
};
