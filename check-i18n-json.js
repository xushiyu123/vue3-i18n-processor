#!/usr/bin/env node

/**
 * 检查国际化 JSON 文件中的翻译质量
 * 使用方法: node check-i18n-json.js <language> <file-path>
 *
 * 参数:
 *   language: 语言代码（en-US, zh-TW 等）
 *   file-path: JSON 文件路径
 *
 * 示例:
 *   node check-i18n-json.js en-US ./i18n-mapping/config.json
 *   node check-i18n-json.js zh-TW ./locales/zh-TW.json
 */

const fs = require('fs');
const path = require('path');

/**
 * 解析命令行参数
 */
function parseArgs() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log(`
使用方法: node check-i18n-json.js <language> <file-path>

参数:
  language: 语言代码（en-US, zh-TW 等）
  file-path: JSON 文件路径

示例:
  node check-i18n-json.js en-US ./i18n-mapping/config.json
  node check-i18n-json.js zh-TW ./locales/zh-TW.json
  node check-i18n-json.js en-US packages/template/src/i18n/en-US/index.ts
`);
    process.exit(0);
  }

  if (args.length < 2) {
    console.error('❌ 错误: 缺少必需参数');
    console.error('使用方法: node check-i18n-json.js <language> <file-path>');
    console.error('使用 --help 查看详细帮助');
    process.exit(1);
  }

  return {
    language: args[0],
    filePath: args[1],
  };
}

/**
 * 检查文件内容
 */
function checkFile(filePath, language) {
  // 检查文件是否存在
  if (!fs.existsSync(filePath)) {
    console.error(`❌ 错误: 文件不存在 - ${filePath}`);
    process.exit(1);
  }

  const content = fs.readFileSync(filePath, 'utf-8');

  // 匹配所有键值对
  const regex = /"([^"]+)":\s*"([^"]*(?:\\.[^"]*)*)"/g;
  let match;
  let issues = [];

  // 根据语言类型定义检查规则
  const checkRules = {
    'en-US': {
      pattern: /[\u4e00-\u9fa5]/, // 检查是否包含中文
      message: '包含中文字符',
    },
    en: {
      pattern: /[\u4e00-\u9fa5]/,
      message: '包含中文字符',
    },
    'zh-TW': {
      pattern:
        /[\u4e00-\u9fa5][\u4e00-\u9fa5]*[\u3001\uff0c\u3002\uff1f\uff01\u300a\u300b\u201c\u201d\u2018\u2019\uff08\uff09\u3010\u3011\u300e\u300f]*/,
      check: (value) => {
        // 检查是否包含简体中文特有字符
        const simplifiedChars = /[国际化处理配置文件夹路径输出模板脚本标签选项显示帮助信息]/;
        return !simplifiedChars.test(value);
      },
      message: '可能包含简体中文',
    },
    'zh-CN': {
      pattern: /[\u4e00-\u9fa5]/,
      check: (value) => {
        // 对于简体中文，检查是否有明显的繁体字
        const traditionalChars = /[繁體]/;
        return !traditionalChars.test(value);
      },
      message: '可能包含繁体中文',
    },
  };

  const rule = checkRules[language] || checkRules['en-US'];

  while ((match = regex.exec(content)) !== null) {
    const key = match[1];
    const value = match[2];

    let hasIssue = false;

    if (rule.check) {
      // 使用自定义检查函数
      hasIssue = !rule.check(value);
    } else {
      // 使用正则模式检查
      hasIssue = rule.pattern.test(value);
    }

    if (hasIssue) {
      const lineNum = content.substring(0, match.index).split('\n').length;
      issues.push({ line: lineNum, key, value });
    }
  }

  return issues;
}

/**
 * 主函数
 */
function main() {
  const { language, filePath } = parseArgs();

  console.log('='.repeat(80));
  console.log(`检查文件: ${filePath}`);
  console.log(`目标语言: ${language}`);
  console.log('='.repeat(80));

  const issues = checkFile(filePath, language);

  if (issues.length === 0) {
    console.log('\n✅ 检查通过！未发现问题。\n');
  } else {
    console.log(`\n❌ 发现 ${issues.length} 处问题:\n`);
    issues.forEach((item, i) => {
      console.log(`${i + 1}. 第 ${item.line} 行`);
      console.log(`   键名: "${item.key}"`);
      console.log(`   值: "${item.value}"`);
      console.log('');
    });
    console.log('='.repeat(80));
    console.log(`总计: ${issues.length} 个问题需要修复`);
  }
  console.log('='.repeat(80));
}

// 运行脚本
if (require.main === module) {
  main();
}
