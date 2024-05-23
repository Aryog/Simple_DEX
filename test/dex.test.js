const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Dex", function () {
    let Dex, dex, Wallet, wallet, MyToken, myToken, USDC, usdc, owner, addr1, addr2, addr3;
    const tokenTicker = ethers.encodeBytes32String("MTK");
    const usdcTicker = ethers.encodeBytes32String("USDC");

    beforeEach(async function () {
        // Get the ContractFactories and Signers here.
        Dex = await ethers.getContractFactory("Dex");
        Wallet = await ethers.getContractFactory("Wallet");
        MyToken = await ethers.getContractFactory("MyToken");
        USDC = await ethers.getContractFactory("MyToken"); // Assuming USDC is also an instance of MyToken for simplicity
        [owner, addr1, addr2, addr3, ...addrs] = await ethers.getSigners();

        // Deploy the wallet contract and then the Dex contract
        wallet = await Wallet.deploy();
        dex = await Dex.deploy();

        // Deploy the MyToken and USDC contract and mint tokens to the owner
        myToken = await MyToken.deploy("MyToken", "MTK", 10000);
        usdc = await USDC.deploy("MyToken", "USDC", 10000);

        // Add MyToken and USDC to the wallet
        await dex.addToken(tokenTicker, await myToken.getAddress());
        await dex.addToken(usdcTicker, await usdc.getAddress());

        // Transfer some tokens to addr1 and addr2 for testing
        await myToken.transfer(addr1.address, 1000);
        await usdc.transfer(addr1.address, 1000);
        await usdc.transfer(addr2.address, 1000);
    });

    describe("Deployment", function () {
        it("Should add the token correctly", async function () {
            const token = await dex.tokenMapping(tokenTicker);
            expect(token.tokenAddress).to.equal(await myToken.getAddress());
        });
    });

    describe("Limit Orders", function () {
        it("Should create a BUY limit order", async function () {
            await usdc.connect(addr1).approve(await dex.getAddress(), 100);

            // Verify approval and balance
            const allowance = await usdc.allowance(addr1.address, await dex.getAddress());
            const balance = await usdc.balanceOf(addr1.address);
            console.log("Allowance:", allowance.toString());
            console.log("Balance:", balance.toString());

            // Create BUY limit order: addr1 wants to buy 100 MTK at the price of 1 USDC per MTK
            await dex.connect(addr1).createLimitOrder(0, tokenTicker, usdcTicker, 100, 1);

            const orderBook = await dex.getOrderBook(tokenTicker, 0);
            expect(orderBook.length).to.equal(1);
            expect(orderBook[0].trader).to.equal(addr1.address);
        });

        it("Should create a SELL limit order", async function () {
            await myToken.connect(addr1).approve(dex.address, 100);
            await dex.connect(addr1).createLimitOrder(1, tokenTicker, usdcTicker, 100, 1);

            const orderBook = await dex.getOrderBook(tokenTicker, 1);
            expect(orderBook.length).to.equal(1);
            expect(orderBook[0].trader).to.equal(addr1.address);
        });
    });

    describe("Market Orders", function () {
        beforeEach(async function () {
            await usdc.connect(addr1).approve(await dex.getAddress(), 100);
            await dex.connect(addr1).createLimitOrder(0, tokenTicker, usdcTicker, 100, 1);

            await myToken.connect(addr2).approve(dex.address, 100);
            await dex.connect(addr2).createLimitOrder(1, tokenTicker, usdcTicker, 100, 1);
        });

        it("Should execute a BUY market order", async function () {
            await usdc.connect(addr3).approve(await dex.getAddress(), 100);
            await dex.connect(addr3).createMarketOrder(0, tokenTicker, usdcTicker, 50);

            const balance = await dex.balances(addr3.address, tokenTicker);
            expect(balance).to.equal(50);
        });

        it("Should execute a SELL market order", async function () {
            await myToken.connect(addr3).approve(await dex.getAddress(), 50);
            await dex.connect(addr3).createMarketOrder(1, tokenTicker, usdcTicker, 50);

            const balance = await dex.balances(addr3.address, usdcTicker);
            expect(balance).to.equal(50);
        });
    });

    describe("Token Conversion", function () {
        it("Should convert tokens using an intermediate token", async function () {
            await myToken.connect(addr1).approve(await dex.getAddress(), 100);
            await dex.connect(addr1).createLimitOrder(1, tokenTicker, usdcTicker, 100, 1);

            await usdc.connect(addr2).approve(await dex.getAddress(), 100);
            await dex.connect(addr2).createLimitOrder(0, usdcTicker, tokenTicker, 100, 1);

            await dex.convertTokens(tokenTicker, usdcTicker, 50, usdcTicker);

            const balance = await dex.balances(addr1.address, usdcTicker);
            expect(balance).to.equal(50);
        });
    });
});
