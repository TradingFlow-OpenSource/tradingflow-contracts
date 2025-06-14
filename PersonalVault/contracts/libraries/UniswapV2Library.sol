// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../interfaces/IUniswapV2Factory.sol";

// 简化版的UniswapV2Library，只包含我们需要的功能
library UniswapV2Library {
    // 返回排序后的token地址
    function sortTokens(address tokenA, address tokenB) internal pure returns (address token0, address token1) {
        require(tokenA != tokenB, 'UniswapV2Library: IDENTICAL_ADDRESSES');
        (token0, token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
        require(token0 != address(0), 'UniswapV2Library: ZERO_ADDRESS');
    }

    // 计算一对token的pair地址
    function pairFor(address factory, address tokenA, address tokenB) internal pure returns (address pair) {
        (address token0, address token1) = sortTokens(tokenA, tokenB);
        pair = address(uint160(uint(keccak256(abi.encodePacked(
            hex'ff',
            factory,
            keccak256(abi.encodePacked(token0, token1)),
            hex'96e8ac4277198ff8b6f785478aa9a39f403cb768dd02cbee326c3e7da348845f' // init code hash
        )))));
    }

    // 获取交易对中的储备量
    function getReserves(address factory, address tokenA, address tokenB) internal view returns (uint reserveA, uint reserveB) {
        (address token0,) = sortTokens(tokenA, tokenB);
        address pair = IUniswapV2Factory(factory).getPair(tokenA, tokenB);
        require(pair != address(0), 'UniswapV2Library: PAIR_NOT_FOUND');
        
        // 这里简化了实现，实际应该调用pair.getReserves()
        // 但由于我们不需要这个功能，所以返回0
        reserveA = 0;
        reserveB = 0;
    }

    // 给定输入金额和储备量，计算输出金额
    function getAmountOut(uint amountIn, uint reserveIn, uint reserveOut) internal pure returns (uint amountOut) {
        require(amountIn > 0, 'UniswapV2Library: INSUFFICIENT_INPUT_AMOUNT');
        require(reserveIn > 0 && reserveOut > 0, 'UniswapV2Library: INSUFFICIENT_LIQUIDITY');
        uint amountInWithFee = amountIn * 997;
        uint numerator = amountInWithFee * reserveOut;
        uint denominator = reserveIn * 1000 + amountInWithFee;
        amountOut = numerator / denominator;
    }
}
