const GasifyToken = artifacts.require('GasifyToken');
const GasifyVault = artifacts.require('GasifyVault');


module.exports = async (deployer, network, accounts) => {
    await deployer.deploy(GasifyToken);
    await deployer.deploy(GasifyVault, GasifyToken.address);
}