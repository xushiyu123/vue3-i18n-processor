#!/usr/bin/env node

/**
 * JSON 差异比较脚本
 * 使用方法: node json-diff.js <json1> <json2> [options]
 *
 * 参数:
 *   json1: 第一个 JSON 文件路径（主文件）
 *   json2: 第二个 JSON 文件路径（要排除的文件）
 *
 * 选项:
 *   --output <path>: 输出文件路径 (默认: ./diff-result.json)
 *   --compare-value: 同时比较 key 和 value，只有完全相同才排除 (默认: 只比较 key)
 *   --help: 显示帮助信息
 *
 * 示例:
 *   node json-diff.js ./json1.json ./json2.json
 *   node json-diff.js ./json1.json ./json2.json --output ./result.json
 *   node json-diff.js ./json1.json ./json2.json --compare-value
 */

const fs = require('fs');
const path = require('path');

/**
 * 解析命令行参数
 */
function parseArgs() {
  const args = process.argv.slice(2);

  if (args.length < 2 || args.includes('--help')) {
    console.log(`
使用方法: node json-diff.js <json1> <json2> [options]

参数:
  json1: 第一个 JSON 文件路径（主文件）
  json2: 第二个 JSON 文件路径（要排除的文件）

选项:
  --output <path>: 输出文件路径 (默认: ./diff-result.json)
  --compare-value: 同时比较 key 和 value，只有完全相同才排除 (默认: 只比较 key)
  --help: 显示帮助信息

示例:
  node json-diff.js ./json1.json ./json2.json
  node json-diff.js ./json1.json ./json2.json --output ./result.json
  node json-diff.js ./json1.json ./json2.json --compare-value
`);
    process.exit(0);
  }

  const config = {
    json1: args[0],
    json2: args[1],
    outputFile: './diff-result.json',
    compareValue: false,
  };

  for (let i = 2; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case '--output':
        config.outputFile = args[++i];
        break;
      case '--compare-value':
        config.compareValue = true;
        break;
      default:
        if (arg.startsWith('--')) {
          console.error(`未知选项: ${arg}`);
          process.exit(1);
        }
    }
  }

  return config;
}

/**
 * 读取 JSON 文件
 */
function readJsonFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      console.error(`❌ 错误: 文件不存在 - ${filePath}`);
      process.exit(1);
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.error(`❌ 读取文件失败 (${filePath}): ${error.message}`);
    process.exit(1);
  }
}

/**
 * 比较两个 JSON 对象，返回 json1 中不在 json2 中的项
 */
function diffJson(json1, json2, compareValue = false) {
  const result = {};
  const removedKeys = [];
  const keptKeys = [];

  for (const [key, value] of Object.entries(json1)) {
    if (compareValue) {
      // 比较 key 和 value
      if (json2.hasOwnProperty(key) && json2[key] === value) {
        removedKeys.push(key);
      } else {
        result[key] = value;
        keptKeys.push(key);
      }
    } else {
      // 只比较 key
      if (json2.hasOwnProperty(key)) {
        removedKeys.push(key);
      } else {
        result[key] = value;
        keptKeys.push(key);
      }
    }
  }

  return {
    result,
    removedKeys,
    keptKeys,
    stats: {
      json1Total: Object.keys(json1).length,
      json2Total: Object.keys(json2).length,
      removed: removedKeys.length,
      kept: keptKeys.length,
    },
  };
}

/**
 * 主函数
 */
function main() {
  try {
    const config = parseArgs();

    console.log('🔍 开始比较 JSON 文件...\n');
    console.log('配置:', {
      主文件: config.json1,
      排除文件: config.json2,
      输出文件: config.outputFile,
      比较模式: config.compareValue ? 'Key + Value' : 'Key Only',
    });
    console.log('');

    // 读取两个 JSON 文件
    console.log('📖 读取文件...');
    const json1 = readJsonFile(config.json1);
    const json2 = readJsonFile(config.json2);
    console.log(`✓ JSON1: ${Object.keys(json1).length} 条数据`);
    console.log(`✓ JSON2: ${Object.keys(json2).length} 条数据\n`);

    // 比较并生成差异结果
    console.log('⚙️  计算差异...');
    const { result, removedKeys, keptKeys, stats } = diffJson(json1, json2, config.compareValue);

    // 显示统计信息
    console.log('\n📊 统计信息:');
    console.log(`  JSON1 总数: ${stats.json1Total}`);
    console.log(`  JSON2 总数: ${stats.json2Total}`);
    console.log(`  移除数量: ${stats.removed}`);
    console.log(`  保留数量: ${stats.kept}`);

    // 显示部分移除的 key
    if (removedKeys.length > 0) {
      console.log('\n🗑️  移除的 Key (前 10 个):');
      removedKeys.slice(0, 10).forEach((key) => {
        console.log(`  - ${key}`);
      });
      if (removedKeys.length > 10) {
        console.log(`  ... 还有 ${removedKeys.length - 10} 个`);
      }
    }

    // 确保输出目录存在
    const outputDir = path.dirname(config.outputFile);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // 写入结果文件
    const jsonContent = JSON.stringify(result, null, 2);
    fs.writeFileSync(config.outputFile, jsonContent, 'utf-8');

    console.log('\n✅ 处理完成！');
    console.log(`📁 输出文件: ${path.resolve(config.outputFile)}`);
    console.log(`📝 结果数量: ${stats.kept} 条`);

    // 生成详细报告（可选）
    const reportFile = config.outputFile.replace(/\.json$/, '-report.txt');
    const report = [
      '='.repeat(60),
      'JSON 差异比较报告',
      '='.repeat(60),
      '',
      `主文件: ${config.json1}`,
      `排除文件: ${config.json2}`,
      `输出文件: ${config.outputFile}`,
      `比较模式: ${config.compareValue ? 'Key + Value' : 'Key Only'}`,
      '',
      '统计信息:',
      `  JSON1 总数: ${stats.json1Total}`,
      `  JSON2 总数: ${stats.json2Total}`,
      `  移除数量: ${stats.removed}`,
      `  保留数量: ${stats.kept}`,
      '',
      '移除的 Key:',
      ...removedKeys.map((key) => `  - ${key}`),
      '',
      '='.repeat(60),
    ].join('\n');

    fs.writeFileSync(reportFile, report, 'utf-8');
    console.log(`📄 详细报告: ${path.resolve(reportFile)}`);
  } catch (error) {
    console.error('❌ 处理失败:', error.message);
    process.exit(1);
  }
}

// 运行脚本
if (require.main === module) {
  main();
}

module.exports = {
  diffJson,
  readJsonFile,
};

