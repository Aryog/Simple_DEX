// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

library SafeMath {
    function add(uint256 a, uint256 b) internal pure returns (uint256) {
        uint256 c = a + b;
        require(c >= a, "+ oflw");

        return c;
    }

    function sub(uint256 a, uint256 b) internal pure returns (uint256) {
        return sub(a, b, "- oflw");
    }

    function sub(
        uint256 a,
        uint256 b,
        string memory errorMessage
    ) internal pure returns (uint256) {
        require(b <= a, errorMessage);
        uint256 c = a - b;

        return c;
    }

    function mul(uint256 a, uint256 b) internal pure returns (uint256) {
        // Gas optimization: this is cheaper than requiring 'a' not being zero, but the
        // benefit is lost if 'b' is also tested.
        // See: https://github.com/OpenZeppelin/openzeppelin-contracts/pull/522
        if (a == 0) {
            return 0;
        }

        uint256 c = a * b;
        require(c / a == b, "* oflw");

        return c;
    }

    function div(uint256 a, uint256 b) internal pure returns (uint256) {
        return div(a, b, "/ 0");
    }

    function div(
        uint256 a,
        uint256 b,
        string memory errorMessage
    ) internal pure returns (uint256) {
        require(b > 0, errorMessage);
        uint256 c = a / b;
        // assert(a == b * c + a % b); // There is no case in which this doesn't hold

        return c;
    }

    function mod(uint256 a, uint256 b) internal pure returns (uint256) {
        return mod(a, b, "% 0");
    }

    function mod(
        uint256 a,
        uint256 b,
        string memory errorMessage
    ) internal pure returns (uint256) {
        require(b != 0, errorMessage);
        return a % b;
    }
}

contract Wallet {
    using SafeMath for uint256;
    struct Token {
        bytes32 ticker; // Symbol for our token
        address tokenAddress;
    }
    bytes32[] public tokenList;
    mapping(bytes32 => Token) public tokenMapping;

    mapping(address => mapping(bytes32 => uint256)) public balances;
    modifier tokenExist(bytes32 ticker) {
        require(
            tokenMapping[ticker].tokenAddress != address(0),
            "Token does not exist"
        );
        _;
    }

    function addToken(bytes32 ticker, address tokenAddress) external {
        tokenMapping[ticker] = Token(ticker, tokenAddress);
        tokenList.push(ticker);
    }

    function deposit(uint amount, bytes32 ticker) external tokenExist(ticker) {
        // Use ERC20 contract of that particular contract
        IERC20(tokenMapping[ticker].tokenAddress).transferFrom(
            msg.sender,
            address(this),
            amount
        );
        balances[msg.sender][ticker] = balances[msg.sender][ticker].add(amount);
    }

    function withdrawal(
        uint amount,
        bytes32 ticker
    ) external tokenExist(ticker) {
        require(
            balances[msg.sender][ticker] >= amount,
            "Balance not sufficient"
        );
        IERC20(tokenMapping[ticker].tokenAddress).transfer(msg.sender, amount);
        balances[msg.sender][ticker] = balances[msg.sender][ticker].sub(amount);
    }
}
