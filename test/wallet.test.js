const { expect } = require("chai");
const { ethers } = require("hardhat")
describe("Wallet", function () {
    let Wallet, wallet, MyToken, myToken, owner, addr1, addr2;
    const tokenTicker = ethers.encodeBytes32String("MTK");

    beforeEach(async function () {
        // Get the ContractFactories and Signers here.
        Wallet = await ethers.getContractFactory("Wallet");
        MyToken = await ethers.getContractFactory("MyToken");
        [owner, addr1, addr2, ...addrs] = await ethers.getSigners();

        // Deploy the wallet contract
        wallet = await Wallet.deploy();
        // await wallet.deployed();

        // Deploy the MyToken contract and mint tokens to the owner
        myToken = await MyToken.deploy("MyToken", "MTK", 1000000);
        // await myToken.deployed();

        // Add MyToken to the wallet
        await wallet.addToken(tokenTicker, await myToken.getAddress());
    });

    describe("Deployment", function () {
        it("Should set the right owner", async function () {
            expect(await wallet.getOwner()).to.equal(owner.address);
        });

        it("Should add the token correctly", async function () {
            const token = await wallet.tokenMapping(tokenTicker);
            expect(token.tokenAddress).to.equal(await myToken.getAddress());
        });
    });

    describe("Transactions", function () {
        it("Should deposit tokens to the wallet", async function () {
            // Approve and deposit tokens to the wallet
            await myToken.approve(await wallet.getAddress(), 100);
            await wallet.deposit(100, tokenTicker);

            const balance = await wallet.balances(owner.address, tokenTicker);
            expect(balance).to.equal(100);
        });

        it("Should withdraw tokens from the wallet", async function () {
            // Approve and deposit tokens to the wallet
            await myToken.approve(await wallet.getAddress(), 100);
            await wallet.deposit(100, tokenTicker);

            // Withdraw tokens from the wallet
            await wallet.withdrawal(50, tokenTicker);

            const balance = await wallet.balances(owner.address, tokenTicker);
            expect(balance).to.equal(50);

            const tokenBalance = await myToken.balanceOf(owner.address);
            expect(tokenBalance).to.equal(1000000 - 100 + 50);
        });

        it("Should revert when trying to withdraw more tokens than the balance", async function () {
            await myToken.approve(await wallet.getAddress(), 100);
            await wallet.deposit(100, tokenTicker);

            await expect(wallet.withdrawal(150, tokenTicker)).to.be.revertedWith("Balance not sufficient");
        });

        it("Should handle non-existent tokens correctly", async function () {
            const nonExistentToken = ethers.encodeBytes32String("NON");
            await expect(wallet.deposit(100, nonExistentToken)).to.be.revertedWith("Token does not exist");
            await expect(wallet.withdrawal(100, nonExistentToken)).to.be.revertedWith("Token does not exist");
        });

        it("Should correctly update balances after multiple deposits and withdrawals", async function () {
            await myToken.approve(await wallet.getAddress(), 200);
            await wallet.deposit(100, tokenTicker);
            await wallet.deposit(50, tokenTicker);
            await wallet.withdrawal(30, tokenTicker);

            const balance = await wallet.balances(owner.address, tokenTicker);
            expect(balance).to.equal(120);

            const tokenBalance = await myToken.balanceOf(owner.address);
            expect(tokenBalance).to.equal(1000000 - 120);
        });
    });

    describe("Ownership", function () {
        it("Should only allow the owner to add new tokens", async function () {
            const newTokenTicker = ethers.encodeBytes32String("NEW");
            await expect(wallet.connect(addr1).addToken(newTokenTicker, addr1.address)).to.be.revertedWith("Ownable: caller is not the owner");
        });

        it("Should not allow adding the same token twice", async function () {
            await expect(wallet.addToken(tokenTicker, await myToken.getAddress())).to.be.revertedWith("Token already exists");
        });
    })

    describe("Utilities", function () {
        it("Should format and parse bytes32 strings correctly", async function () {
            const formatted = ethers.encodeBytes32String("MTK");
            expect(formatted).to.equal(tokenTicker);

            const parsed = ethers.decodeBytes32String(formatted);
            expect(parsed).to.equal("MTK");
        });
    });
});
