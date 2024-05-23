// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./Wallet.sol";

contract Dex is Wallet {
    enum OrderType {
        BUY,
        SELL
    }

    struct Order {
        uint id;
        address trader;
        OrderType orderType;
        bytes32 baseTicker;
        bytes32 quoteTicker;
        uint amount;
        uint price;
        uint filled; // amount of the order that has been filled
    }

    uint public nextOrderId;
    mapping(bytes32 => Order[]) public topBuyOrders;
    mapping(bytes32 => Order[]) public topSellOrders;

    event NewOrder(
        uint id,
        address indexed trader,
        OrderType orderType,
        bytes32 indexed baseTicker,
        bytes32 indexed quoteTicker,
        uint amount,
        uint price,
        uint timestamp
    );

    function getOrderBook(
        bytes32 baseTicker,
        OrderType orderType
    ) external view returns (Order[] memory) {
        return
            orderType == OrderType.BUY
                ? topBuyOrders[baseTicker]
                : topSellOrders[baseTicker];
    }

    function createLimitOrder(
        OrderType orderType,
        bytes32 baseTicker,
        bytes32 quoteTicker,
        uint amount,
        uint price
    ) public tokenExist(baseTicker) tokenExist(quoteTicker) {
        if (orderType == OrderType.SELL) {
            require(
                balances[msg.sender][baseTicker] >= amount,
                "Insufficient base token balance"
            );
        } else {
            require(
                balances[msg.sender][quoteTicker] >= amount * price,
                "Insufficient quote token balance"
            );
        }

        Order[] storage orders = orderType == OrderType.BUY
            ? topBuyOrders[baseTicker]
            : topSellOrders[baseTicker];
        orders.push(
            Order(
                nextOrderId,
                msg.sender,
                orderType,
                baseTicker,
                quoteTicker,
                amount,
                price,
                0
            )
        );
        nextOrderId++;

        emit NewOrder(
            nextOrderId,
            msg.sender,
            orderType,
            baseTicker,
            quoteTicker,
            amount,
            price,
            block.timestamp
        );

        sortOrders(orderType, orders);
    }

    function createMarketOrder(
        OrderType orderType,
        bytes32 baseTicker,
        bytes32 quoteTicker,
        uint amount
    ) public tokenExist(baseTicker) tokenExist(quoteTicker) {
        if (orderType == OrderType.SELL) {
            require(
                balances[msg.sender][baseTicker] >= amount,
                "Insufficient base token balance"
            );
        }

        Order[] storage orders = orderType == OrderType.BUY
            ? topSellOrders[baseTicker]
            : topBuyOrders[baseTicker];
        uint remaining = amount;

        for (uint i = 0; i < orders.length && remaining > 0; i++) {
            uint available = orders[i].amount - orders[i].filled;
            uint matched = remaining > available ? available : remaining;
            remaining -= matched;
            orders[i].filled += matched;

            if (orderType == OrderType.BUY) {
                require(
                    balances[msg.sender][quoteTicker] >=
                        matched * orders[i].price,
                    "Insufficient quote token balance"
                );
                balances[msg.sender][quoteTicker] -= matched * orders[i].price;
                balances[orders[i].trader][quoteTicker] +=
                    matched *
                    orders[i].price;
                balances[msg.sender][baseTicker] += matched;
                balances[orders[i].trader][baseTicker] -= matched;
            } else {
                balances[msg.sender][baseTicker] -= matched;
                balances[msg.sender][quoteTicker] += matched * orders[i].price;
                balances[orders[i].trader][quoteTicker] -=
                    matched *
                    orders[i].price;
                balances[orders[i].trader][baseTicker] += matched;
            }

            if (orders[i].filled == orders[i].amount) {
                orders[i] = orders[orders.length - 1];
                orders.pop();
            }
        }

        if (remaining > 0 && orderType == OrderType.BUY) {
            createLimitOrder(
                orderType,
                baseTicker,
                quoteTicker,
                remaining,
                orders[0].price
            );
        }
    }

    function sortOrders(OrderType orderType, Order[] storage orders) internal {
        uint i = orders.length > 0 ? orders.length - 1 : 0;
        if (orderType == OrderType.BUY) {
            while (i > 0 && orders[i - 1].price < orders[i].price) {
                Order memory temp = orders[i];
                orders[i] = orders[i - 1];
                orders[i - 1] = temp;
                i--;
            }
        } else {
            while (i > 0 && orders[i - 1].price > orders[i].price) {
                Order memory temp = orders[i];
                orders[i] = orders[i - 1];
                orders[i - 1] = temp;
                i--;
            }
        }
    }

    function convertTokens(
        bytes32 fromTicker,
        bytes32 toTicker,
        uint amount,
        bytes32 intermediateTicker
    )
        external
        tokenExist(fromTicker)
        tokenExist(toTicker)
        tokenExist(intermediateTicker)
    {
        createMarketOrder(
            OrderType.SELL,
            fromTicker,
            intermediateTicker,
            amount
        );
        uint intermediateAmount = balances[msg.sender][intermediateTicker];
        createMarketOrder(
            OrderType.BUY,
            toTicker,
            intermediateTicker,
            intermediateAmount
        );
    }
}
