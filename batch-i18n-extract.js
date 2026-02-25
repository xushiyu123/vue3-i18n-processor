#!/usr/bin/env node

/**
 * 批量提取国际化文本脚本（只提取，不修改文件）
 * 使用方法: node batch-i18n-extract.js <folder-path> [options]
 *
 * 参数:
 *   folder-path: 要扫描的文件夹路径（相对路径）
 *
 * 选项:
 *   --output <path>: 国际化映射输出路径 (默认: ./<文件夹名>-extract.json)
 *   --no-template: 不提取 Vue template 中的文本
 *   --no-script: 不提取 Vue script 中的文本
 *   --no-ts: 不提取 TypeScript 文件中的文本
 *   --help: 显示帮助信息
 *
 * 示例:
 *   node batch-i18n-extract.js ./src/views
 *   node batch-i18n-extract.js ./src/components --output ./extract-result.json
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
  ignorePaths: ['node_modules', 'dist', '.git', '*.d.ts'],
  fileExtensions: ['.vue', '.ts', '.js'],
};

const configPath = path.join(__dirname, 'i18n.config.js');
if (fs.existsSync(configPath)) {
  try {
    const loadedConfig = require(configPath);
    userConfig = { ...userConfig, ...loadedConfig };
    console.log('✓ 已加载配置文件: i18n.config.js');
  } catch (error) {
    console.warn('⚠ 加载配置文件失败，使用默认配置:', error.message);
  }
}

// 默认配置
const defaultConfig = {
  extractVueTemplate: true,
  extractVueScript: true,
  extractTs: true,
  outputPath: './i18n-extract.json',
};

// 全局状态
let globalI18nMap = {};
let extractedFiles = [];

/**
 * 解析命令行参数
 */
function parseArgs() {
  const args = process.argv.slice(2);
  if (args.length === 0 || args.includes('--help')) {
    console.log(`
使用方法: node batch-i18n-extract.js <folder-path> [options]

参数:
  folder-path: 要扫描的文件夹路径（相对路径）

选项:
  --output <path>: 国际化映射输出路径 (默认: ./<文件夹名>-extract.json)
  --no-template: 不提取 Vue template 中的文本
  --no-script: 不提取 Vue script 中的文本
  --no-ts: 不提取 TypeScript 文件中的文本
  --help: 显示帮助信息

示例:
  node batch-i18n-extract.js ./src/views
  node batch-i18n-extract.js ./src/components --output ./extract-result.json
`);
    process.exit(0);
  }
  const config = { ...defaultConfig };
  config.folderPath = args[0];
  let hasCustomOutput = false;
  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case '--no-template':
        config.extractVueTemplate = false;
        break;
      case '--no-script':
        config.extractVueScript = false;
        break;
      case '--no-ts':
        config.extractTs = false;
        break;
      case '--output':
        config.outputPath = args[++i];
        hasCustomOutput = true;
        break;
      default:
        if (arg.startsWith('--')) {
          console.error(`未知选项: ${arg}`);
          process.exit(1);
        }
    }
  }
  // 如果用户没有指定输出路径，根据文件夹名生成默认文件名
  if (!hasCustomOutput) {
    const folderName = path.basename(path.resolve(config.folderPath));
    config.outputPath = `./${folderName}-extract.json`;
  }
  return config;
}

/**
 * 检查路径是否匹配忽略模式
 */
function shouldIgnorePath(filePath, ignorePaths) {
  const fileName = path.basename(filePath);
  const relativePath = path.relative(process.cwd(), filePath);
  for (const pattern of ignorePaths) {
    if (
      fileName === pattern ||
      filePath.includes(`${path.sep}${pattern}${path.sep}`) ||
      filePath.endsWith(`${path.sep}${pattern}`)
    ) {
      return true;
    }
    if (pattern.includes('*')) {
      const regexPattern = pattern.replace(/\./g, '\\.').replace(/\*/g, '.*');
      const regex = new RegExp(regexPattern);
      if (regex.test(fileName) || regex.test(relativePath)) {
        return true;
      }
    }
  }
  return false;
}

/**
 * 递归获取所有需要处理的文件
 */
async function getAllFiles(dirPath, extensions = ['.vue', '.ts']) {
  const files = [];
  async function traverse(currentPath) {
    try {
      const items = await readdir(currentPath);
      for (const item of items) {
        const itemPath = path.join(currentPath, item);
        const itemStat = await stat(itemPath);
        if (shouldIgnorePath(itemPath, userConfig.ignorePaths)) {
          continue;
        }
        if (itemStat.isDirectory()) {
          await traverse(itemPath);
        } else if (itemStat.isFile()) {
          const ext = path.extname(item);
          if (extensions.includes(ext)) {
            files.push(itemPath);
          }
        }
      }
    } catch (error) {
      console.warn(`无法读取目录 ${currentPath}: ${error.message}`);
    }
  }
  await traverse(dirPath);
  return files;
}

/**
 * 移除注释
 */
function removeComments(text) {
  let result = text;
  result = result.replace(/\/\/.*$/gm, '');
  result = result.replace(/\/\*[\s\S]*?\*\//g, '');
  result = result.replace(/<!--[\s\S]*?-->/g, '');
  result = result.replace(/^[ \t]*#.*$/gm, '');
  return result;
}

/**
 * 从文本中提取中文词条（不做过滤，提取所有包含中文的文本）
 */
function extractChineseTerms(text, context = 'script', filePath = '') {
  const terms = [];

  // 提取双引号内容
  const doubleQuoteRegex = /"([^"]*)"/g;
  let match;
  while ((match = doubleQuoteRegex.exec(text)) !== null) {
    const content = match[1].trim();
    // 跳过外层嵌套引号
    if (content.startsWith("'") && content.endsWith("'")) {
      continue;
    }
    // 只检查是否包含中文
    if (content && /[\u4e00-\u9fa5]/.test(content)) {
      terms.push({ content, type: 'double-quote', original: match[0], file: filePath });
    }
  }

  // 提取单引号内容
  const singleQuoteRegex = /'([^']*)'/g;
  while ((match = singleQuoteRegex.exec(text)) !== null) {
    const content = match[1].trim();
    const alreadyExtracted = terms.some((t) => t.content === content);
    if (alreadyExtracted) continue;
    // 跳过外层嵌套引号
    if (content.startsWith('"') && content.endsWith('"')) {
      continue;
    }
    // 只检查是否包含中文
    if (content && /[\u4e00-\u9fa5]/.test(content)) {
      terms.push({ content, type: 'single-quote', original: match[0], file: filePath });
    }
  }

  // 提取模板字符串
  const templateRegex = /`([^`]*)`/g;
  while ((match = templateRegex.exec(text)) !== null) {
    const content = match[1].trim();
    // 只检查是否包含中文
    if (content && /[\u4e00-\u9fa5]/.test(content)) {
      terms.push({ content, type: 'template', original: match[0], file: filePath });
    }
  }

  // 提取标签间内容（仅限 template）
  if (context === 'template') {
    const tagContentRegex = />([^<>]*?)</gs;
    while ((match = tagContentRegex.exec(text)) !== null) {
      const content = match[1].trim();
      // 只检查是否包含中文，跳过包含引号和插值表达式的内容
      if (
        content &&
        /[\u4e00-\u9fa5]/.test(content) &&
        !content.includes('"') &&
        !content.includes("'") &&
        !content.includes('{{') &&
        !content.includes('}}')
      ) {
        terms.push({ content, type: 'tag-content', original: match[0], file: filePath });
      }
    }
  }

  return terms;
}

/**
 * 提取 Vue 文件中的文本
 */
async function extractFromVueFile(filePath, config) {
  const content = await readFile(filePath, 'utf-8');
  const relativePath = path.relative(process.cwd(), filePath);
  const extracted = { template: [], script: [] };

  console.log(`扫描 Vue 文件: ${relativePath}`);

  // 提取 template
  const templateMatch = content.match(/<template[^>]*>([\s\S]*)<\/template>/i);
  if (templateMatch && config.extractVueTemplate) {
    const templateContent = templateMatch[1];
    const cleanTemplate = removeComments(templateContent);
    const terms = extractChineseTerms(cleanTemplate, 'template', relativePath);
    extracted.template = terms;
  }

  // 提取 script
  const scriptMatch = content.match(/<script[^>]*>([\s\S]*?)<\/script>/i);
  if (scriptMatch && config.extractVueScript) {
    const scriptContent = scriptMatch[1];
    const cleanScript = removeComments(scriptContent);
    const terms = extractChineseTerms(cleanScript, 'script', relativePath);
    extracted.script = terms.filter((term) => !term.content.includes('import'));
  }

  return extracted;
}

/**
 * 提取 TypeScript 文件中的文本
 */
async function extractFromTsFile(filePath, config) {
  const content = await readFile(filePath, 'utf-8');
  const relativePath = path.relative(process.cwd(), filePath);
  const cleanContent = removeComments(content);

  console.log(`扫描 TS 文件: ${relativePath}`);

  const terms = extractChineseTerms(cleanContent, 'script', relativePath);
  return terms.filter((term) => !term.content.includes('import'));
}

/**
 * 提取单个文件
 */
async function extractFile(filePath, config) {
  const ext = path.extname(filePath);
  const relativePath = path.relative(process.cwd(), filePath);

  try {
    if (ext === '.vue') {
      const extracted = await extractFromVueFile(filePath, config);
      const allTerms = [...extracted.template, ...extracted.script];
      return { success: true, terms: allTerms, count: allTerms.length };
    } else if (ext === '.ts' || ext === '.js') {
      if (!config.extractTs) {
        return { success: true, terms: [], count: 0 };
      }
      const terms = await extractFromTsFile(filePath, config);
      return { success: true, terms, count: terms.length };
    } else {
      return { success: true, terms: [], count: 0 };
    }
  } catch (error) {
    console.error(`提取文件 ${relativePath} 时出错:`, error.message);
    return { success: false, terms: [], count: 0, error: error.message };
  }
}

/**
 * 主函数
 */
async function main() {
  try {
    const config = parseArgs();
    console.log('🚀 开始提取国际化文本...\n');
    console.log('配置:', {
      文件夹: config.folderPath,
      提取Vue模板: config.extractVueTemplate,
      提取Vue脚本: config.extractVueScript,
      提取TS文件: config.extractTs,
      输出路径: config.outputPath,
    });
    console.log('');

    // 检查文件夹是否存在
    if (!fs.existsSync(config.folderPath)) {
      console.error(`❌ 错误: 文件夹 ${config.folderPath} 不存在`);
      process.exit(1);
    }

    // 获取所有需要处理的文件
    const files = await getAllFiles(config.folderPath, userConfig.fileExtensions);
    console.log(`\n找到 ${files.length} 个文件需要扫描\n`);

    if (files.length === 0) {
      console.log('没有找到需要扫描的文件');
      return;
    }

    // 逐个提取文件
    let totalExtracted = 0;
    let successCount = 0;
    const allTerms = [];

    for (const filePath of files) {
      const result = await extractFile(filePath, config);
      if (result.success) {
        successCount++;
        totalExtracted += result.count;
        allTerms.push(...result.terms);
        if (result.count > 0) {
          console.log(`✓ ${path.relative(process.cwd(), filePath)} (${result.count} 项)`);
        }
      } else {
        console.log(`✗ ${path.relative(process.cwd(), filePath)} - ${result.error}`);
      }
    }

    // 去重并生成映射
    const uniqueTexts = new Set();
    allTerms.forEach((term) => {
      if (!uniqueTexts.has(term.content)) {
        uniqueTexts.add(term.content);
        globalI18nMap[term.content] = term.content;
      }
    });

    // 输出结果文件
    if (Object.keys(globalI18nMap).length > 0) {
      const outputPath = path.resolve(config.outputPath);
      const outputDir = path.dirname(outputPath);
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      const jsonContent = JSON.stringify(globalI18nMap, null, 2);
      await writeFile(outputPath, jsonContent, 'utf-8');
      console.log(`\n✓ 提取结果已保存到: ${outputPath}`);
    }

    // 输出统计信息
    console.log('\n=== 提取完成 ===');
    console.log(`总计扫描: ${files.length} 个文件`);
    console.log(`成功扫描: ${successCount} 个文件`);
    console.log(`提取词条: ${totalExtracted} 项`);
    console.log(`唯一词条: ${Object.keys(globalI18nMap).length} 项`);
  } catch (error) {
    console.error('❌ 提取失败:', error.message);
    process.exit(1);
  }
}

// 运行脚本
if (require.main === module) {
  main();
}

module.exports = {
  extractFile,
  extractFromVueFile,
  extractFromTsFile,
  extractChineseTerms,
};
