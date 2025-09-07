class CivicPulseApp {
    constructor() {
        this.web3 = null;
        this.contract = null;
        this.account = null;
        this.citizenHash = null;
        this.init();
    }
    
    async init() {
        try {
            // initialize Web3 and connect to wallet
            const web3Initialized = await this.initWeb3();
            if (!web3Initialized) {
                console.error('Failed to initialize Web3');
                return;
            }

            // initialize contract
            await this.initContract();
            this.initEventListeners();
            if (this.account) {
                await this.loadData();
            }
            
            console.log('App initialized successfully');
        } catch (error) {
            console.error('Initialization error:', error);
            this.showNotification('Failed to initialize the application', 'error');
        }
    }
    
    async initContract() {
        try {
            // Get the contract ABI and address from the build files
            let contractABI;
            let contractAddress;
            
            try {
           
                const contractData = require('./build/contracts/Civics.json');
                contractABI = contractData.abi;
                
                // get the network ID to find the correct address
                const networkId = await this.web3.eth.net.getId();
                
               
                if (networkId === 1337) { // network ID for Ganache
                    contractAddress = '0xF7ca9AE56D32Ed69616013543292812403888DCE';
                } else {
                    contractAddress = contractData.networks[networkId]?.address;
                    if (!contractAddress) {
                        console.warn('No deployed contract found for network ID:', networkId);
                        throw new Error('No contract deployed on this network');
                    }
                }
            } catch (e) {
                console.warn('Could not load contract from build files, using default ABI and address');
                
                contractABI = [

                    {
                        "constant": false,
                        "inputs": [{"name":"citizenHash","type":"bytes32"}],
                        "name": "registerCitizen",
                        "outputs": [],
                        "stateMutability": "nonpayable",
                        "type": "function"
                    },
                    {
                        "constant": true,
                        "inputs": [{"name":"","type":"bytes32"}],
                        "name": "registeredCitizens",
                        "outputs": [{"name":"","type":"bool"}],
                        "stateMutability": "view",
                        "type": "function"
                    }
                ];
                contractAddress = '0xCfEB869F69431e42cdB54A4F4f105C19C080A601';
            }
            
      
            this.contract = new this.web3.eth.Contract(contractABI, contractAddress);
            this.contractAddress = contractAddress;
            
            console.log('Contract initialized at:', contractAddress);
            console.log('Using network ID:', await this.web3.eth.net.getId());
        } catch (error) {
            console.error('Error initializing contract:', error);
        }
    }
    
    async initWeb3() {
        try {
           
            if (window.ethereum) {
                this.web3 = new Web3(window.ethereum);
              
                const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
                this.account = accounts[0];
                
                
                window.ethereum.on('accountsChanged', (accounts) => {
                    this.account = accounts[0];
                    this.loadData();
                });
                
               
                window.ethereum.on('chainChanged', () => {
                    window.location.reload();
                });
                
                console.log('Using MetaMask with account:', this.account);
                return true;
            }
          
            else if (window.web3) {
                this.web3 = new Web3(web3.currentProvider);
                const accounts = await this.web3.eth.getAccounts();
                this.account = accounts[0];
                console.log('Using legacy web3 provider with account:', this.account);
                return true;
            }
           
            else {
                const provider = new Web3.providers.HttpProvider('http://127.0.0.1:7545');
                this.web3 = new Web3(provider);
                const accounts = await this.web3.eth.getAccounts();
                this.account = accounts[0];
                console.log('Using Ganache provider with account:', this.account);
                return true;
            }
        } catch (error) {
            console.error('Error initializing Web3:', error);
            this.showNotification('Failed to connect to Web3 provider', 'error');
            return false;
        }
    }
    
    async connectWallet() {
        try {
          
            if (!this.web3) {
                const initialized = await this.initWeb3();
                if (!initialized) {
                    throw new Error('Failed to initialize Web3');
                }
            }
            
        
            this.citizenHash = this.web3.utils.keccak256(
                this.account + "civic_pulse_salt"
            );
            
            // check if already registered
            const isRegistered = await this.contract.methods.registeredCitizens(this.citizenHash).call();
            
            if (!isRegistered) {
                // show registration confirmation
                const shouldRegister = confirm('You need to register as a citizen to continue. This will require a transaction. Continue?');
                if (!shouldRegister) {
                    throw new Error('Registration cancelled by user');
                }
                
             
                this.showNotification('Registering as citizen... Please confirm the transaction in MetaMask', 'info');
                
                // register citizen
                try {
                    const tx = await this.contract.methods.registerCitizen(this.citizenHash)
                        .send({ from: this.account });
                        
                    if (tx.status) {
                        this.showNotification('Successfully registered as a citizen!', 'success');
                    } else {
                        throw new Error('Transaction failed');
                    }
                } catch (error) {
                    console.error('Registration error:', error);
                    throw new Error('Failed to register as citizen: ' + (error.message || 'Transaction rejected'));
                }
            }
            
          
            const connectButton = document.getElementById('connectWallet');
            if (connectButton) {
                connectButton.textContent = `Connected: ${this.account.substring(0, 8)}...`;
                connectButton.disabled = true;
            }
            
            
            await this.loadData();
            
            return true;
        } catch (error) {
            console.error('Connection failed:', error);
            this.showNotification(
                error.message.includes('User denied') 
                    ? 'Connection was rejected' 
                    : 'Failed to connect wallet', 
                'error'
            );
            return false;
        }
    }
    
    async vote(proposalId, vote) {
        if (!this.citizenHash) {
            alert('Please connect your wallet first');
            return;
        }
        
        try {
            await this.contract.methods.vote(
                proposalId, 
                vote, 
                this.citizenHash
            ).send({ from: this.account });
            
            await this.loadProposals(); 
            this.showNotification('Vote cast successfully!');
        } catch (error) {
            console.error('Voting failed:', error);
            alert('Voting failed. You may have already voted.');
        }
    }
    
    async createProposal(title, description, duration) {
        try {
            await this.contract.methods.createProposal(
                title, 
                description, 
                duration
            ).send({ from: this.account });
            
            await this.loadProposals();
            this.showNotification('Proposal created successfully!');
        } catch (error) {
            console.error('Proposal creation failed:', error);
        }
    }
    
    async reportIssue(category, description, location) {
        try {
            await this.contract.methods.reportIssue(
                category, 
                description, 
                location, 
                this.citizenHash
            ).send({ from: this.account });
            
            await this.loadIssues();
            this.showNotification('Issue reported successfully!');
        } catch (error) {
            console.error('Issue reporting failed:', error);
        }
    }
    
    showNotification(message, type = 'info') {
        const notification = document.getElementById('notification');
        if (!notification) return;
        
        notification.textContent = message;
        notification.className = 'notification';
        notification.classList.add(type);
        notification.style.display = 'block';
        
        
        setTimeout(() => {
            notification.style.display = 'none';
        }, 5000);
    }
    
    
}

// initialize 
const app = new CivicPulseApp();