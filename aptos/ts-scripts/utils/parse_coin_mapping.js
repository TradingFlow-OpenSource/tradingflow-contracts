#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * 解析coin.json文件，生成代币符号到地址的映射
 * 去重逻辑：优先选择index值较小的条目，如果index相同则选择faType
 */

const coinFilePath = path.join(__dirname, 'coin.json');
const outputFilePath = path.join(__dirname, 'symbol_to_address_mapping.json');

function parseCoinMapping() {
    try {
        // 读取coin.json文件
        const coinData = JSON.parse(fs.readFileSync(coinFilePath, 'utf8'));
        
        console.log(`读取到 ${coinData.length} 个代币条目`);
        
        // 使用Map来去重，key为symbol，value为代币信息
        const symbolMap = new Map();
        
        coinData.forEach((coin, i) => {
            const symbol = coin.symbol;
            
            // 跳过空symbol
            if (!symbol || symbol.trim() === '') {
                console.log(`跳过空symbol的条目 ${i}`);
                return;
            }
            
            // 优先使用faType，如果没有则使用assetType
            let address = coin.faType || coin.assetType;
            
            // 如果是APT，使用特殊处理
            if (symbol === 'APT') {
                address = '0xa';
            }
            
            // 检查是否已存在该symbol
            if (symbolMap.has(symbol)) {
                const existing = symbolMap.get(symbol);
                
                // 去重逻辑：优先选择index较小的，如果index相同则保持原有的
                if (coin.index !== null && existing.index !== null) {
                    if (coin.index < existing.index) {
                        console.log(`替换 ${symbol}: index ${existing.index} -> ${coin.index}`);
                        symbolMap.set(symbol, {
                            address: address,
                            name: coin.name,
                            decimals: coin.decimals,
                            index: coin.index,
                            coingeckoId: coin.coingeckoId,
                            tags: coin.tags
                        });
                    }
                } else if (coin.index !== null && existing.index === null) {
                    // 新条目有index，现有条目没有，替换
                    console.log(`替换 ${symbol}: 添加index ${coin.index}`);
                    symbolMap.set(symbol, {
                        address: address,
                        name: coin.name,
                        decimals: coin.decimals,
                        index: coin.index,
                        coingeckoId: coin.coingeckoId,
                        tags: coin.tags
                    });
                }
                // 其他情况保持现有条目
            } else {
                // 首次添加该symbol
                symbolMap.set(symbol, {
                    address: address,
                    name: coin.name,
                    decimals: coin.decimals,
                    index: coin.index,
                    coingeckoId: coin.coingeckoId,
                    tags: coin.tags
                });
                console.log(`添加新代币: ${symbol} -> ${address}`);
            }
        });
        
        console.log(`\n去重后共有 ${symbolMap.size} 个唯一代币符号`);
        
        // 生成Python格式的映射
        const pythonMapping = {};
        symbolMap.forEach((tokenInfo, symbol) => {
            pythonMapping[symbol] = tokenInfo.address;
        });
        
        // 生成详细信息
        const detailedMapping = {};
        symbolMap.forEach((tokenInfo, symbol) => {
            detailedMapping[symbol] = tokenInfo;
        });
        
        // 保存结果
        const result = {
            python_mapping: pythonMapping,
            detailed_mapping: detailedMapping,
            statistics: {
                total_entries: coinData.length,
                unique_symbols: symbolMap.size,
                generated_at: new Date().toISOString()
            }
        };
        
        fs.writeFileSync(outputFilePath, JSON.stringify(result, null, 2));
        
        console.log(`\n结果已保存到: ${outputFilePath}`);
        console.log(`Python映射条目数: ${Object.keys(pythonMapping).length}`);
        
        // 打印Python格式的映射（用于直接复制）
        console.log('\n=== Python格式映射 ===');
        console.log('_aptos_token_symbol_to_address = {');
        Object.entries(pythonMapping)
            .sort(([a], [b]) => a.localeCompare(b))
            .forEach(([symbol, address]) => {
                console.log(`    "${symbol}": "${address}",`);
            });
        console.log('}');
        
        // 打印一些统计信息
        console.log('\n=== 统计信息 ===');
        console.log(`总代币数: ${coinData.length}`);
        console.log(`去重后: ${symbolMap.size}`);
        
        // 按标签分类统计
        const tagStats = {};
        symbolMap.forEach((tokenInfo) => {
            if (tokenInfo.tags && Array.isArray(tokenInfo.tags)) {
                tokenInfo.tags.forEach(tag => {
                    tagStats[tag] = (tagStats[tag] || 0) + 1;
                });
            }
        });
        
        console.log('\n按标签分类:');
        Object.entries(tagStats)
            .sort(([,a], [,b]) => b - a)
            .forEach(([tag, count]) => {
                console.log(`  ${tag}: ${count}`);
            });
        
        return result;
        
    } catch (error) {
        console.error('解析coin.json时出错:', error);
        throw error;
    }
}

// 运行解析
if (require.main === module) {
    parseCoinMapping();
}

module.exports = { parseCoinMapping };
