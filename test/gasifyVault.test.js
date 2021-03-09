const GasifyToken = artifacts.require('GasifyToken');
const GasifyVault = artifacts.require('GasifyVault');
const { expectEvent } = require('@openzeppelin/test-helpers')

const toWei = (_amount, _unit) => web3.utils.toWei(_amount.toString(), _unit);

contract('GasifyVault', async ([deployer, user1, user2]) => {
    beforeEach(async () => {
        this.token = await GasifyToken.new({ from: deployer });
        this.contract = await GasifyVault.new(this.token.address, { from: deployer });

        // should send 100 tokens to 
        await this.token.transfer(user1, toWei(100, "ether"), { from: deployer });
    })

    describe('deployment', () => {
        it("should token address properly", async () => {
            const tokenAddress = await this.contract.GasifyVaultAddress();
            assert.equal(tokenAddress, this.token.address);
        })

        it("should set rewardsPool properly", async () => {
            const rewardsPool = await this.contract.rewardsPool();
            assert.equal(rewardsPool.toString(), "0");
        })

        it("should set total locked properly", async () => {
            const getTotalLockedBalance = await this.contract.getTotalLockedBalance();
            assert.equal(getTotalLockedBalance.toString(), "0");
        })

        it("should set lockStatus properly", async () => {
            const lockStatus = await this.contract.lockStatus();
            assert.equal(lockStatus.toString(), "0");
        })
    })

    describe("lock", () => {
        let _amount;
        let reciept;

        beforeEach(async () => {
            _amount = toWei(100, "ether");
            await this.token.approve(this.contract.address, _amount, { from: user1 });
            reciept = await this.contract.lock(_amount, { from: user1 });
        })

        it("should lock token properly", async () => {
            const { user, amount } = await this.contract.locks(user1);
            assert.equal(user, user1);
            assert.equal(amount.toString(), _amount);
        })

        it("should reject duplicate stakes", async () => {
            try {
                await this.contract.lock(_amount, { from: user1 });
            } catch (error) {
                assert(error.message.includes("GasifyVault: Active lock found"));
                return;
            }
            assert(false);
        })

        it("should increment getTotalLockedBalance", async () => {
            const getTotalLockedBalance = await this.contract.getTotalLockedBalance();
            assert.equal(getTotalLockedBalance.toString(), _amount);
        })

        it("should increment getLockedTokens", async () => {
            const getLockedTokens = await this.contract.getLockedTokens(user1);
            assert.equal(getLockedTokens.toString(), _amount);
        })

        it("should emit Locked event", async () => {
            expectEvent(reciept, "Locked", {
                user: user1,
                amount: _amount
            })
        })
    })

    describe("seedRewards", () => {
        let _amount;
        let reciept;

        beforeEach(async () => {
            _amount = toWei(100, "ether");
            await this.token.approve(this.contract.address, _amount, { from: deployer });
            reciept = await this.contract.seedRewards(_amount, { from: deployer });
        })

        it("should increment rewardsPool properly", async () => {
            const rewardsPool = await this.contract.rewardsPool();
            assert.equal(rewardsPool.toString(), _amount);
        })

        it("should emit RewardsSeeded event", async () => {
            expectEvent(reciept, "RewardsSeeded", {
                admin: deployer,
                amount: _amount
            })
        })

        it("should reject if owner is not the caller", async () => {
            try {
                await this.contract.seedRewards(_amount, {  from: user1 });
            } catch (error) {
                assert(error.message.includes("Ownable: caller is not the owner"));
                return;
            }
            assert(false);
        })
    })

    describe("pause", () => {
        beforeEach(async () => {
            await this.contract.pause({ from: deployer });
        })

        it("should pause lock function", async () => {
            const lockStatus = await this.contract.lockStatus();
            assert.equal(lockStatus.toString(), "1");
        })

        it("should reject duplicate pausje action", async () => {
            try {
                await this.contract.pause({ from: deployer });
            } catch (error) {
                assert(error.message.includes("GasifyVault: lock is currently paused"));
                return;
            }
            assert(false);
        })

        it("should reject if owner is not the caller", async () => {
            try {
                await this.contract.unpause({ from: deployer });
                await this.contract.pause({ from: user1 });
            } catch (error) {
                assert(error.message.includes("Ownable: caller is not the owner"));
                return;
            }
            assert(false);
        })

        it("should reject lock function call", async () => {
            try {
                const _amount = toWei(100, "ether");
                await this.token.approve(this.contract.address, _amount, { from: user1 });
                await this.contract.lock(_amount, { from: user1 });
            } catch (error) {
                assert(error.message.includes("GasifyVault: lock is currently paused"));
                return;
            }
            assert(false);
        })
    })

    describe("unpause", () => {
        beforeEach(async () => {
            await this.contract.pause({ from: deployer });
            await this.contract.unpause({ from: deployer });
        })

        it("should unpause lock function", async () => {
            const lockStatus = await this.contract.lockStatus();
            assert.equal(lockStatus.toString(), "0");
        })

        it("should reject duplicate unpause action", async () => {
            try {
                await this.contract.unpause({ from: deployer });
            } catch (error) {
                assert(error.message.includes("GasifyVault: lock is currently active"));
                return;
            }
            assert(false);
        })

        it("should reject if owner is not the caller", async () => {
            try {
                await this.contract.pause({ from: deployer });
                await this.contract.unpause({  from: user1 });
            } catch (error) {
                assert(error.message.includes("Ownable: caller is not the owner"));
                return;
            }
            assert(false);
        })

        it("should accept lock function call", async () => {
            const _amount = toWei(100, "ether");
            await this.token.approve(this.contract.address, _amount, { from: user1 });
            await this.contract.lock(_amount, { from: user1 });
        })
    })

    describe("unlock", () => {
        let _amount;

        beforeEach(async () => {
            _amount = toWei(100, "ether");
            await this.token.approve(this.contract.address, _amount, { from: deployer });
            await this.token.approve(this.contract.address, _amount, { from: user1 });
            await this.contract.seedRewards(_amount, { from: deployer });
            await this.contract.lock(_amount, { from: user1 });
        })

        it("should reject if endtime is block.timestamp", async () => {
            try {
                await this.contract.unlock({ from: user1 });
            } catch (error) {
                assert(error.message.includes("GasifyVault: stakes is currently locked"));
                return;
            }
            assert(false);
        })

        it("should reject if there is no valid stake", async () => {
            try {
                await this.contract.unlock({ from: user2 });
            } catch (error) {
                assert(error.message.includes("GasifyVault: No active lock found"));
                return;
            }
            assert(false);
        })

        // it("should unlock locked tokens", async () => {
        //     await this.contract.unlock({ from: user1 });
        //     const _userBalance = await this.token.balanceOf(user1);
        //     assert.equal(_userBalance.toString(), toWei(140, "ether"));
        // })

        // it("should decrement totalLockedBalance", async () => {
        //     await this.contract.unlock({ from: user1 });
        //     const totalLockedBalance = await this.contract.getTotalLockedBalance();
        //     assert.equal(totalLockedBalance.toString(), "0");
        // })

        // it("should decrement rewardsPool", async () => {
        //     await this.contract.unlock({ from: user1 });
        //     const rewardsPool = await this.contract.rewardsPool();
        //     assert.equal(rewardsPool.toString(), toWei(60, "ether"));
        // })

        // it("should reset user locked balance", async () => {
        //     await this.contract.unlock({ from: user1 });
        //     const getLockedTokens = await this.contract.getLockedTokens(user1);
        //     const { amount } = await this.contract.locks(user1);

        //     assert.equal(getLockedTokens.toString(), "0");
        //     assert.equal(amount.toString(), "0");
        // })

        // it("should emit Unlocked", async () => {
        //     const reciept = await this.contract.unlock({ from: user1 });
        //     expectEvent(reciept, "Unlocked", {
        //         user: user1,
        //         amount: toWei(140, "ether")
        //     })
        // })
    })
})