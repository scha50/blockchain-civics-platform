const Civics = artifacts.require("./Civics.sol");

module.exports = function(deployer) {
  deployer.deploy(Civics);
};


