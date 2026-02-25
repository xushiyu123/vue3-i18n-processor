#!/usr/bin/env node

/**
 * 合并国际化 JSON 词条脚本
 * 使用方法: node merge-i18n-json.js [options]
 *
 * 说明:
 *   默认会从 i18n.config.js 配置文件中读取 outputPath 作为输入目录
 *
 * 选项:
 *   --input <path>: JSON 文件所在目录（默认: 从配置文件读取 outputPath）
 *   --output <path>: 合并后的输出文件路径（默认: ./merged-i18n.json）
 *   --pattern <glob>: 文件匹配模式（默认: *.json，匹配所有 JSON 文件）
 *   --overwrite: 如果遇到重复的 key，后面的值覆盖前面的（默认: false，不覆盖会警告）
 *   --sort: 按 key 排序输出（默认: false）
 *
 * 示例:
 *   node merge-i18n-json.js
 *   node merge-i18n-json.js --output ./locales/zh-CN.json
 *   node merge-i18n-json.js --pattern "*.json" --sort
 *   node merge-i18n-json.js --input ./custom-path --overwrite --sort
 */

const fs = require('fs');
const path = require('path');
const { promisify } = require('util');

const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);
const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);

// 加载用户配置文件
let userConfig = {
  outputPath: './i18n-mapping',
};

const configPath = path.join(__dirname, 'i18n.config.js');
if (fs.existsSync(configPath)) {
  try {
    const loadedConfig = require(configPath);
    userConfig = { ...userConfig, ...loadedConfig };
    console.log('✓ 已加载配置文件: i18n.config.js\n');
  } catch (error) {
    console.warn('⚠ 加载配置文件失败，使用默认配置:', error.message);
  }
}

// 默认配置
const defaultConfig = {
  inputDir: userConfig.outputPath || './i18n-mapping',
  outputFile: './merged-i18n.json',
  pattern: '*.json',
  overwrite: false,
  sort: false,
};

/**
 * 解析命令行参数
 */
function parseArgs() {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
使用方法: node merge-i18n-json.js [options]

说明:
  默认会从 i18n.config.js 配置文件中读取 outputPath 作为输入目录

选项:
  --input <path>: JSON 文件所在目录（默认: 从配置文件读取 outputPath）
  --output <path>: 合并后的输出文件路径（默认: ./merged-i18n.json）
  --pattern <glob>: 文件匹配模式（默认: *.json，匹配所有 JSON 文件）
  --overwrite: 如果遇到重复的 key，后面的值覆盖前面的（默认: false）
  --sort: 按 key 排序输出（默认: false）
  --help, -h: 显示帮助信息

示例:
  node merge-i18n-json.js
  node merge-i18n-json.js --output ./locales/zh-CN.json
  node merge-i18n-json.js --pattern "*.json" --sort
  node merge-i18n-json.js --input ./custom-path --overwrite --sort
`);
    process.exit(0);
  }
  const config = { ...defaultConfig };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case '--input':
        config.inputDir = args[++i];
        break;
      case '--output':
        config.outputFile = args[++i];
        break;
      case '--pattern':
        config.pattern = args[++i];
        break;
      case '--overwrite':
        config.overwrite = true;
        break;
      case '--sort':
        config.sort = true;
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
 * 简单的 glob 匹配
 */
function matchPattern(filename, pattern) {
  const regexPattern = pattern.replace(/\./g, '\\.').replace(/\*/g, '.*').replace(/\?/g, '.');
  const regex = new RegExp(`^${regexPattern}$`);
  return regex.test(filename);
}

/**
 * 获取目录下所有匹配的 JSON 文件
 */
async function getMatchingFiles(dirPath, pattern) {
  const files = [];
  try {
    const items = await readdir(dirPath);
    for (const item of items) {
      const itemPath = path.join(dirPath, item);
      const itemStat = await stat(itemPath);
      if (itemStat.isFile() && matchPattern(item, pattern)) {
        files.push(itemPath);
      }
    }
  } catch (error) {
    console.error(`无法读取目录 ${dirPath}: ${error.message}`);
  }
  return files;
}

/**
 * 读取并解析 JSON 文件
 */
async function readJsonFile(filePath) {
  try {
    const content = await readFile(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.warn(`读取文件 ${filePath} 失败: ${error.message}`);
    return null;
  }
}

/**
 * 合并多个 JSON 对象
 */
function mergeJsonObjects(jsonObjects, overwrite = false) {
  const merged = {};
  const conflicts = [];
  const stats = {
    totalKeys: 0,
    filesProcessed: 0,
    conflicts: 0,
  };
  jsonObjects.forEach(({ data, file }) => {
    if (!data) return;
    stats.filesProcessed++;
    Object.keys(data).forEach((key) => {
      if (merged.hasOwnProperty(key) && merged[key] !== data[key]) {
        conflicts.push({
          key,
          oldValue: merged[key],
          newValue: data[key],
          file,
        });
        stats.conflicts++;
        if (overwrite) {
          merged[key] = data[key];
        }
      } else {
        merged[key] = data[key];
      }
    });
  });
  stats.totalKeys = Object.keys(merged).length;
  return { merged, conflicts, stats };
}

/**
 * 主函数
 */
async function main() {
  try {
    const config = parseArgs();
    console.log('🚀 开始合并国际化 JSON 文件...\n');
    console.log('配置:', {
      输入目录:
        config.inputDir + (config.inputDir === defaultConfig.inputDir ? ' (从配置文件)' : ''),
      输出文件: config.outputFile,
      文件模式: config.pattern,
      覆盖模式: config.overwrite ? '是' : '否',
      排序输出: config.sort ? '是' : '否',
    });
    console.log('');
    // 检查输入目录是否存在
    const inputDirResolved = path.resolve(config.inputDir);
    if (!fs.existsSync(inputDirResolved)) {
      console.error(`❌ 错误: 输入目录 ${config.inputDir} 不存在`);
      console.error(`   提示: 请检查 i18n.config.js 中的 outputPath 配置是否正确`);
      process.exit(1);
    }
    // 检查输入路径是否是目录
    const inputStat = fs.statSync(inputDirResolved);
    if (!inputStat.isDirectory()) {
      console.error(`❌ 错误: ${config.inputDir} 不是一个目录`);
      process.exit(1);
    }
    // 获取所有匹配的 JSON 文件
    const files = await getMatchingFiles(config.inputDir, config.pattern);
    if (files.length === 0) {
      console.log(`⚠️  未找到匹配的 JSON 文件 (模式: ${config.pattern})`);
      return;
    }
    console.log(`📁 找到 ${files.length} 个 JSON 文件:\n`);
    files.forEach((file) => {
      console.log(`  - ${path.relative(process.cwd(), file)}`);
    });
    console.log('');
    // 读取所有 JSON 文件
    const jsonObjects = [];
    for (const file of files) {
      const data = await readJsonFile(file);
      if (data) {
        jsonObjects.push({ data, file: path.relative(process.cwd(), file) });
        console.log(`✓ 已读取: ${path.basename(file)} (${Object.keys(data).length} 个词条)`);
      }
    }
    console.log('');
    // 合并 JSON 对象
    const { merged, conflicts, stats } = mergeJsonObjects(jsonObjects, config.overwrite);
    // 显示冲突信息
    if (conflicts.length > 0) {
      console.log(`⚠️  发现 ${conflicts.length} 个重复的 key:\n`);
      conflicts.slice(0, 10).forEach(({ key, oldValue, newValue, file }) => {
        console.log(`  Key: "${key}"`);
        console.log(`    已存在: "${oldValue}"`);
        console.log(`    新值 (${file}): "${newValue}"`);
        console.log(`    ${config.overwrite ? '✓ 已覆盖' : '✗ 未覆盖（保持原值）'}`);
        console.log('');
      });
      if (conflicts.length > 10) {
        console.log(`  ... 还有 ${conflicts.length - 10} 个冲突未显示\n`);
      }
      if (!config.overwrite) {
        console.log('💡 提示: 使用 --overwrite 选项可以用新值覆盖旧值\n');
      }
    }
    // 排序（如果需要）
    let finalMerged = merged;
    if (config.sort) {
      const sortedKeys = Object.keys(merged).sort();
      finalMerged = {};
      sortedKeys.forEach((key) => {
        finalMerged[key] = merged[key];
      });
      console.log('✓ 已按 key 排序\n');
    }
    // 写入输出文件
    const outputPath = path.resolve(config.outputFile);
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
      console.log(`✓ 创建输出目录: ${outputDir}\n`);
    }
    const jsonContent = JSON.stringify(finalMerged, null, 2);
    await writeFile(outputPath, jsonContent, 'utf-8');
    console.log('=== 合并完成 ===');
    console.log(`处理文件: ${stats.filesProcessed} 个`);
    console.log(`总词条数: ${stats.totalKeys} 个`);
    console.log(`重复词条: ${stats.conflicts} 个`);
    console.log(`输出文件: ${outputPath}\n`);
    console.log('✅ 成功！');
  } catch (error) {
    console.error('❌ 合并失败:', error.message);
    process.exit(1);
  }
}

// 运行脚本
if (require.main === module) {
  main();
}

module.exports = {
  mergeJsonObjects,
  getMatchingFiles,
  readJsonFile,
};
