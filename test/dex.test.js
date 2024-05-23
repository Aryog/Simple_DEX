const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Dex", function () {
    let Dex, dex, Wallet, wallet, MyToken, myToken, USDC, usdc, owner, addr1, addr2, addr3;
    const tokenTicker = ethers.encodeBytes32String("MTK");
    const usdcTicker = ethers.encodeBytes32String("USDC");
    const btcTicker = ethers.encodeBytes32String("BTC");

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
        await myToken.transfer(addr2.address, 1000);
        await usdc.transfer(addr2.address, 1000);
        await myToken.transfer(addr3.address, 1000);
        await usdc.transfer(addr3.address, 1000);
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
            // Approved 100 usdc to dex contract so that it can deposit that erc-20 token
            await dex.connect(addr1).deposit(100, usdcTicker)

            // Create BUY limit order: addr1 wants to buy 100 MTK at the price of 1 USDC per MTK
            console.log(await usdc.balanceOf(addr1.address) + " usdc", 100 * 1 + " usdc")
            console.log(await dex.connect(addr1).balances(addr1, usdcTicker))
            await dex.connect(addr1).createLimitOrder(0, tokenTicker, usdcTicker, 100, 1);

            const orderBook = await dex.getOrderBook(tokenTicker, 0); // Order book for buy
            expect(orderBook.length).to.equal(1);
            expect(orderBook[0].trader).to.equal(addr1.address);
        });

        it("Should create a SELL limit order", async function () {
            // To sell the tokenTicker you should have enough tokenTicker and trans
            await myToken.connect(addr1).approve(await dex.getAddress(), 100);
            await dex.connect(addr1).deposit(100, tokenTicker);

            // Create SELL limit order: addr1 wants to sell 100 MTK at the price of 1 USDC per MTK
            await dex.connect(addr1).createLimitOrder(1, tokenTicker, usdcTicker, 100, 1);

            const orderBook = await dex.getOrderBook(tokenTicker, 1); // Order book for sell
            expect(orderBook.length).to.equal(1);
            expect(orderBook[0].trader).to.equal(addr1.address);
        });
    });

    describe("Market Orders", function () {
        beforeEach(async function () {
            await usdc.connect(addr1).approve(await dex.getAddress(), 100);
            await dex.connect(addr1).deposit(100, usdcTicker)
            await dex.connect(addr1).createLimitOrder(0, tokenTicker, usdcTicker, 100, 1);

            await myToken.connect(addr2).approve(await dex.getAddress(), 100);
            await dex.connect(addr2).deposit(100, tokenTicker)
            await dex.connect(addr2).createLimitOrder(1, tokenTicker, usdcTicker, 100, 1);
        });

        it("Should execute a BUY market order", async function () {
            // Buying 60 MTK tokens using 100 USDC
            await usdc.connect(addr3).approve(await dex.getAddress(), 100);
            await dex.connect(addr3).deposit(100, usdcTicker);
            await dex.connect(addr3).createMarketOrder(0, tokenTicker, usdcTicker, 60);

            const balance = await dex.balances(addr3.address, tokenTicker);
            expect(balance).to.equal(60);
        });

        it("Should execute a SELL market order", async function () {
            // Selling 50 MTK tokens to get 50 USDC
            await myToken.connect(addr3).approve(await dex.getAddress(), 50);
            await dex.connect(addr3).deposit(50, tokenTicker)
            await dex.connect(addr3).createMarketOrder(1, tokenTicker, usdcTicker, 50);

            const balance = await dex.balances(addr3.address, usdcTicker);
            expect(balance).to.equal(50);
        });
    });

    describe("Token Conversion", function () {
        it("Should convert tokens using an intermediate token", async function () {
            const BTC = await ethers.getContractFactory("MyToken");
            const btc = await BTC.deploy("MyToken", "BTC", 10000)
            await dex.addToken(btcTicker, await btc.getAddress());

            // Approve and deposit MyToken from addr1 || selling 100 MTK tokens to get 100 USDC
            await myToken.connect(addr1).approve(await dex.getAddress(), 100);
            await dex.connect(addr1).deposit(100, tokenTicker);
            await dex.connect(addr1).createLimitOrder(1, tokenTicker, usdcTicker, 100, 1);
            console.log(await dex.getOrderBook(tokenTicker, 1))

            // Approve and deposit USDC from addr2 || buying 50 BTC using 100 USDC
            await usdc.connect(addr2).approve(await dex.getAddress(), 100);
            await dex.connect(addr2).deposit(100, usdcTicker);
            await dex.connect(addr2).createLimitOrder(0, btcTicker, usdcTicker, 50, 2); // Changed tokenTicker to btcTicker
            console.log(await dex.getOrderBook(btcTicker, 0))

            // Convert MTK to BTC using USDC as intermediate token
            await myToken.connect(addr3).approve(await dex.getAddress(), 150);
            await dex.connect(addr3).deposit(150, tokenTicker);
            await dex.connect(addr3).convertTokens(tokenTicker, btcTicker, 50, usdcTicker);

            // Check BTC balance for addr1 after conversion
            const btcBalance = await dex.balances(addr1.address, btcTicker);
            console.log("BTC balance for addr1:", btcBalance);
            expect(btcBalance).to.equal(50);
        });
    });

});
