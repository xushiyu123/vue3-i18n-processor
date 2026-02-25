#!/usr/bin/env node

/**
 * JSON 转 Excel 脚本
 * 使用方法: node json-to-excel.js <json-file> [options]
 *
 * 参数:
 *   json-file: JSON 文件路径
 *
 * 选项:
 *   --output <path>: Excel 输出文件路径 (默认: ./i18n-excel/<文件名>.xlsx)
 *   --key-header <name>: Key 列的表头名称 (默认: "Key")
 *   --value-header <name>: Value 列的表头名称 (默认: "Value")
 *   --help: 显示帮助信息
 *
 * 示例:
 *   node json-to-excel.js ./i18n-mapping/cdn.json
 *   node json-to-excel.js ./locales/zh-CN.json --output ./custom/output.xlsx
 *   node json-to-excel.js ./data.json --key-header "中文" --value-header "英文"
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
使用方法: node json-to-excel.js <json-file> [options]

参数:
  json-file: JSON 文件路径

选项:
  --output <path>: Excel 输出文件路径 (默认: ./i18n-excel/<文件名>.xlsx)
  --key-header <name>: Key 列的表头名称 (默认: "Key")
  --value-header <name>: Value 列的表头名称 (默认: "Value")
  --help: 显示帮助信息

示例:
  node json-to-excel.js ./i18n-mapping/cdn.json
  node json-to-excel.js ./locales/zh-CN.json --output ./custom/output.xlsx
  node json-to-excel.js ./data.json --key-header "中文" --value-header "英文"
`);
    process.exit(0);
  }

  const config = {
    jsonFile: args[0],
    outputFile: null,
    keyHeader: 'Key',
    valueHeader: 'Value',
  };

  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case '--output':
        config.outputFile = args[++i];
        break;
      case '--key-header':
        config.keyHeader = args[++i];
        break;
      case '--value-header':
        config.valueHeader = args[++i];
        break;
      default:
        if (arg.startsWith('--')) {
          console.error(`未知选项: ${arg}`);
          process.exit(1);
        }
    }
  }

  // 如果没有指定输出文件，默认放到 i18n-excel 文件夹下
  if (!config.outputFile) {
    const jsonPath = path.parse(config.jsonFile);
    config.outputFile = path.join('i18n-excel', jsonPath.name + '.xlsx');
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
    console.error(`❌ 读取 JSON 文件失败: ${error.message}`);
    process.exit(1);
  }
}

/**
 * 生成简单的 Excel XML 格式（SpreadsheetML）
 */
function jsonToExcelXml(jsonData, keyHeader, valueHeader) {
  const xmlHeader = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Styles>
  <Style ss:ID="Header">
   <Font ss:Bold="1"/>
   <Interior ss:Color="#D3D3D3" ss:Pattern="Solid"/>
   <Alignment ss:Vertical="Center" ss:WrapText="1"/>
  </Style>
  <Style ss:ID="WrapText">
   <Alignment ss:Vertical="Top" ss:WrapText="1"/>
  </Style>
 </Styles>
 <Worksheet ss:Name="Sheet1">
  <Table>
   <Column ss:Width="300"/>
   <Column ss:Width="300"/>`;

  const xmlFooter = `  </Table>
 </Worksheet>
</Workbook>`;

  // 转义 XML 特殊字符，并处理换行符
  function escapeXml(text) {
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;')
      .replace(/\n/g, '&#10;') // 将换行符转换为 XML 实体
      .replace(/\r/g, ''); // 移除回车符
  }

  // 生成表头行
  let rows = `   <Row>
    <Cell ss:StyleID="Header"><Data ss:Type="String">${escapeXml(keyHeader)}</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">${escapeXml(valueHeader)}</Data></Cell>
   </Row>\n`;

  // 生成数据行
  for (const [key, value] of Object.entries(jsonData)) {
    rows += `   <Row>
    <Cell ss:StyleID="WrapText"><Data ss:Type="String">${escapeXml(key)}</Data></Cell>
    <Cell ss:StyleID="WrapText"><Data ss:Type="String">${escapeXml(value)}</Data></Cell>
   </Row>\n`;
  }

  return xmlHeader + rows + xmlFooter;
}

/**
 * 主函数
 */
function main() {
  try {
    const config = parseArgs();

    console.log('📊 开始转换 JSON 到 Excel...\n');
    console.log('配置:', {
      输入文件: config.jsonFile,
      输出文件: config.outputFile,
      Key列名: config.keyHeader,
      Value列名: config.valueHeader,
    });
    console.log('');

    // 读取 JSON 文件
    const jsonData = readJsonFile(config.jsonFile);
    const entryCount = Object.keys(jsonData).length;
    console.log(`✓ 读取 JSON 文件成功 (${entryCount} 条数据)\n`);

    // 生成 Excel XML
    const excelXml = jsonToExcelXml(jsonData, config.keyHeader, config.valueHeader);

    // 确保输出目录存在
    const outputDir = path.dirname(config.outputFile);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // 写入文件
    fs.writeFileSync(config.outputFile, excelXml, 'utf-8');

    console.log('✅ 转换成功！');
    console.log(`📁 输出文件: ${path.resolve(config.outputFile)}`);
    console.log(`📝 数据行数: ${entryCount}`);
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
  jsonToExcelXml,
};
