pragma solidity ^0.5.0;

contract Civics {

    struct Proposal {
        uint256 id;
        string title;
        string description;
        uint256 yesVotes;
        uint256 noVotes;
        uint256 deadline;
        bool active; 
        address creator;
        mapping(bytes32 => bool) hasVoted;
    }
    struct Issue{
        uint256 id;
        string category;
        string description; 
        string location;
        uint256 timestamp;
        uint256 upvotes;
        mapping(bytes32 => bool) hasUpvoted;
    }
    mapping(uint256 => Proposal) public proposals;
    mapping(uint256 => Issue) public issues;
    mapping(bytes32 => bool) public registeredCitizens;

    uint256 public proposalCount;
    uint256 public issueCount;
    uint256 constant ESCALATION_THRESHOLD=100;

    event ProposalCreated(uint256 indexed id, string title);
    event VoteCast(uint256 indexed proposalId, bool vote);
    event IssueReported(uint256 indexed id, string category);
    event ProposalEscalated(uint256 indexed id);

    modifier onlyRegistered(bytes32 citizenHash) {
        require(registeredCitizens[citizenHash], "Citizen not registered");
        _;
    }
    function registerCitizen(bytes32 citizenHash) external {
        registeredCitizens[citizenHash] = true;
    }

    function createProposal(
        string calldata _title,
        string calldata _description,
        uint256 _duration
    ) external {
        proposalCount++;
        Proposal storage newProposal = proposals[proposalCount];
        newProposal.id = proposalCount;
        newProposal.title = _title;
        newProposal.description = _description;
        newProposal.deadline = block.timestamp + _duration;
        newProposal.active = true;
        newProposal.creator = msg.sender;
        
        emit ProposalCreated(proposalCount, _title);
    }

    function vote(
        uint256 _proposalId,
        bool _vote,
        bytes32 _citizenHash
    ) external onlyRegistered(_citizenHash) {
        Proposal storage proposal = proposals[_proposalId];
        require(proposal.active, "Proposal not active");
        require(block.timestamp < proposal.deadline, "Voting ended");
        require(!proposal.hasVoted[_citizenHash], "Already voted");
        
        proposal.hasVoted[_citizenHash] = true;
        
        if (_vote) {
            proposal.yesVotes++;
        } else {
            proposal.noVotes++;
        }
        
        emit VoteCast(_proposalId, _vote);
        
        // Check for escalation
        if (proposal.yesVotes + proposal.noVotes >= ESCALATION_THRESHOLD) {
            emit ProposalEscalated(_proposalId);
        }
    }

    function reportIssue(
        string calldata _category,
        string calldata _description,
        string calldata _location,
        bytes32 _citizenHash
    ) external onlyRegistered(_citizenHash) {
        issueCount++;
        Issue storage newIssue = issues[issueCount];
        newIssue.id = issueCount;
        newIssue.category = _category;
        newIssue.description = _description;
        newIssue.location = _location;
        newIssue.timestamp = block.timestamp;
        
        emit IssueReported(issueCount, _category);
    }

    function upvoteIssue(
        uint256 _issueId,
        bytes32 _citizenHash
    ) external onlyRegistered(_citizenHash) {
        Issue storage issue = issues[_issueId];
        require(!issue.hasUpvoted[_citizenHash], "Already upvoted");
        
        issue.hasUpvoted[_citizenHash] = true;
        issue.upvotes++;
    }

    
    function deleteProposal(uint256 _proposalId) external {
        Proposal storage proposal = proposals[_proposalId];
        require(proposal.creator == msg.sender, "Only creator can delete");
        require(proposal.yesVotes == 0 && proposal.noVotes == 0, "Cannot delete after voting started");
        
        proposal.active = false;
        proposal.title = "[DELETED]";
        proposal.description = "[This proposal has been deleted by the creator]";
        
        emit ProposalDeleted(_proposalId);
    }
    
    function deleteIssue(uint256 _issueId, bytes32 _citizenHash) external onlyRegistered(_citizenHash) {
        Issue storage issue = issues[_issueId];
        require(issue.upvotes == 0, "Cannot delete after upvotes received");
        
        issue.category = "deleted";
        issue.description = "[This issue has been deleted]";
        issue.location = "[DELETED]";
        
        emit IssueDeleted(_issueId);
    }
    
    // Additional events
    event ProposalDeleted(uint256 indexed proposalId);
    event IssueDeleted(uint256 indexed issueId);
     
}