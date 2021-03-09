// SPDX-License-Identifier: MIT
pragma solidity 0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract GasifyVault is Ownable {
    IERC20 public GasifyVaultAddress;
    uint256 public rewardsPool;
    uint256 private totalLockedBalance;
    uint8 private _isPaused;
    
    struct Lock {
        address user;
        uint256 amount;
        uint256 unlockTime;
    }
    
    mapping(address => Lock) public locks;
    
    event Locked(
        address indexed user,
        uint256 amount,
        uint256 startTime,
        uint256 unlockTime
    );
    
    event Unlocked(
        address indexed user,
        uint256 amount,
        uint256 unlockTime
    );
    
    event RewardsSeeded(
        address indexed admin,
        uint256 indexed amount
    );
    
    modifier whenNotPaused() {
        require(_isPaused == 0, "GasifyVault: lock is currently paused");
        _;
    }

    constructor(IERC20 _GasifyVaultAddress) {
        GasifyVaultAddress = _GasifyVaultAddress;
        totalLockedBalance = 0;
        rewardsPool = 0;
        _isPaused = 0;
    }
    
    receive() external payable {
        revert("You can not ETH token directly to the contract");
    }
    
    function lock(uint256 _amount) external whenNotPaused {
        require(locks[_msgSender()].amount == 0, "GasifyVault: Active lock found");
        uint256 _unlockTime = block.timestamp + 30 days;
        
        GasifyVaultAddress.transferFrom(_msgSender(), address(this), _amount);
        totalLockedBalance += _amount;
        
        locks[_msgSender()] = Lock(
            _msgSender(),
            _amount,
            _unlockTime
        );
        emit Locked(_msgSender(), _amount, block.timestamp, _unlockTime);
    }
    
    function unlock() external {
        require(locks[_msgSender()].unlockTime <= block.timestamp, "GasifyVault: stakes is currently locked");
        require(locks[_msgSender()].amount > 0, "GasifyVault: No active lock found");
        
        uint256 _amount = locks[_msgSender()].amount;
        
        locks[_msgSender()].amount = 0;
        totalLockedBalance -= _amount;
        
        uint256 _rewards = calculateRewards(_amount);
        rewardsPool -= _rewards;
        
        uint256 _totalValue = _amount + _rewards;
        GasifyVaultAddress.transfer(_msgSender(), _totalValue);
        emit Unlocked(_msgSender(), _totalValue, block.timestamp);
    }
    
    function calculateRewards(uint256 _amount) internal pure returns(uint256) {
        uint256 _rewards = (_amount * 40) / 100;
        return _rewards;
    }
    
    function getLockedTokens(address _account) external view returns(uint256) {
        return locks[_account].amount;
    }
    
    function getTotalLockedBalance() external view returns(uint256) {
        return totalLockedBalance;
    }
    
    function seedRewards(uint256 _amount) external onlyOwner {
        GasifyVaultAddress.transferFrom(_msgSender(), address(this), _amount);
        rewardsPool += _amount;
        emit RewardsSeeded(_msgSender(), _amount);
    }
    
    
    function pause() external onlyOwner {
        require(_isPaused == 0, "GasifyVault: lock is currently paused");
        _isPaused = 1;
    }
    
    function unpause() external onlyOwner {
        require(_isPaused == 1, "GasifyVault: lock is currently active");
        _isPaused = 0;
    }
    
    function lockStatus() external view returns(uint8) {
        return _isPaused;
    }
    
    
    function withdrawLockedToken(address _tokenAddress) external onlyOwner {
        uint256 _balance = IERC20(_tokenAddress).balanceOf(address(this));
        IERC20(_tokenAddress).transfer(owner(), _balance);
    }
}