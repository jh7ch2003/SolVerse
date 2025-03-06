const socket = io();
let roomId;
let displayName;
let intervalId;
const heliusApiKey = 'f5704630-83c9-4627-bffa-d7da240bf76c'; // Replace with your Helius API key

function isValidSolanaAddress(address) {
    if (typeof address !== 'string') {
        return false;
    }
    if (address.length < 44) {
        return false;
    }
    const validChars = /^[1-9A-HJ-NP-Za-km-z]+$/;
    return validChars.test(address);
}

async function fetchMarketCap(address) {
    const apiUrl = `https://api.jup.ag/swap/v1/quote?inputMint=${address}&outputMint=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v&amount=100000000&slippageBps=50&restrictIntermediateTokens=true`;
    try {
        const response = await fetch(apiUrl);
        const data = await response.json();

        if (data && data.outAmount) {
            const priceInUsdc = parseFloat(data.outAmount) / 100000000;
            const totalSupply = 1000000000; // Replace with your actual total supply retrieval logic
            let marketCap = priceInUsdc * totalSupply;
            let formattedMarketCap;

            if (marketCap >= 1000000) {
                formattedMarketCap = (marketCap / 1000000).toFixed(2) + "M";
            } else if (marketCap >= 1000) {
                formattedMarketCap = (marketCap / 1000).toFixed(2) + "K";
            } else {
                formattedMarketCap = marketCap.toFixed(2);
            }

            return formattedMarketCap;
        } else {
            return "Market cap not found";
        }
    } catch (error) {
        console.error("Error fetching market cap:", error);
        return "Error fetching market cap";
    }
}

async function getTokenInfo(address) {
    const response = await fetch(`https://mainnet.helius-rpc.com/?api-key=${heliusApiKey}`, {
        method: 'POST',
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            "jsonrpc": "2.0",
            "id": "text",
            "method": "getAsset",
            "params": { id: address }
        }),
    });
    const data = await response.json();
    if(data && data.result && data.result.content && data.result.content.metadata){
        return {
            name: data.result.content.metadata.name,
            symbol: data.result.content.metadata.symbol
        }
    } else {
        return {name: "Name not found", symbol: "Symbol not found"};
    }
}

async function updateMarketCap() {
    const marketCap = await fetchMarketCap(roomId);
    const tokenInfo = await getTokenInfo(roomId);
    document.getElementById('market-cap').textContent = `${tokenInfo.name} ($${tokenInfo.symbol}) | Market Cap: $${marketCap}`;
}

function joinRoom() {
    roomId = document.getElementById('room-id').value;
    displayName = document.getElementById('display-name').value;

    if (roomId.trim() === "" || displayName.trim() === "") {
        alert("Please enter both Room ID and Display Name.");
        return;
    }

    if (!isValidSolanaAddress(roomId)) {
        alert("Invalid Solana contract address.");
        return;
    }

    socket.emit('joinRoom', { roomId, displayName });

    socket.on('joinedRoom', async (data) => {
        document.getElementById('join-room').style.display = 'none';
        document.getElementById('logo').style.display = 'none';
        document.getElementById('chat-area').style.display = 'block';
        document.getElementById('bubble').style.display = 'block';
        document.getElementById('chart').style.display = 'block';
        document.getElementById('hold').style.display = 'block';

        document.getElementById("bubble").setAttribute("src",`https://trench.bot/bundles/${roomId}`)
        document.getElementById("chart").setAttribute("src",`https://www.solanatracker.io/chart/embed/${roomId}`)

        const h3Elements = document.querySelectorAll('h3');
        h3Elements.forEach(h3 => {
            h3.style.display = 'none';
        });

        const messagesList = document.getElementById('messages');
        data.messageHistory.forEach(msg => {
            displayMessage(`<b>${msg.user}:</b> ${msg.message}`);
        });

        updateMarketCap();
        intervalId = setInterval(updateMarketCap, 5000);
    });


    socket.on('userJoined', (data) => {
        displayMessage(`${data.displayName} has joined the chat.`);
    });

    socket.on('userLeft', (data) => {
        displayMessage(`${data.displayName} has left the chat.`);
    });

    socket.on('chatMessage', (data) => {
        displayMessage(`<b>${data.user}</b>: ${data.message}`);
    });

    socket.on('userList', (users) => {
        const userList = document.getElementById('user-list');
        userList.innerHTML = '';

        const countLi = document.createElement('li');
        countLi.innerHTML = `<b>Total users: ${users.length}</b>`;
        userList.appendChild(countLi);
    });

    socket.on('error', (error) => {
        alert(error);
    });

    socket.on('disconnect', () => {
        clearInterval(intervalId);
        alert("You have been disconnected from the server.");
        location.reload();
    });
}

function sendMessage() {
    const message = document.getElementById('message-input').value;
    if (message.trim() !== "") {
        socket.emit('chatMessage', message);
        document.getElementById('message-input').value = '';
    }
}

function displayMessage(message) {
    const messagesList = document.getElementById('messages');
    const newMessage = document.createElement('li');
    const sanitizedMessage = DOMPurify.sanitize(message);
    newMessage.innerHTML = sanitizedMessage;
    messagesList.appendChild(newMessage);
    messagesList.scrollTop = messagesList.scrollHeight;
}

document.getElementById('message-input').addEventListener('keyup', (event) => {
    if (event.key === 'Enter') {
        sendMessage();
    }
});

