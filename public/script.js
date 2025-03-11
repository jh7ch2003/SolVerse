const socket = io();
let roomId;
let displayName;
let intervalId;



function isValidSolanaAddress(address) {
    if (typeof address !== 'string') {
        return false;
    }
    if (address.length < 36) {
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
    try {
        const response = await fetch(`/tokenInfo?address=${address}`); // Request the server
        const data = await response.json();
        if (data && data.name && data.symbol) {
            return {
                name: data.name,
                symbol: data.symbol
            };
        } else {
            return { name: "Name not found", symbol: "Symbol not found" };
        }
    } catch (error) {
        console.error("Error fetching token info:", error);
        return { name: "Error", symbol: "Error" };
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
        // Fade out initial elements
        document.getElementById('join-room').style.opacity = '0';
        document.getElementById('logo').style.opacity = '0.3';
        document.getElementById('X').style.opacity = '0';
        const h3Elements = document.querySelectorAll('h3');
        h3Elements.forEach(h3 => {
            h3.style.opacity = '0';
        });

        // Wait for fade out and then hide
        setTimeout(() => {
            document.getElementById('join-room').style.display = 'none';
            document.getElementById('logo').style.display = 'none';
            document.getElementById('X').style.display = 'none';
            h3Elements.forEach(h3 => {
                h3.style.display = 'none';
            });

            // Fade in transition video
            const transitionVideo = document.getElementById('transition');
            transitionVideo.style.display = 'block';
            transitionVideo.style.opacity = '1';
            transitionVideo.play();

            // Fade out video and fade in chat elements simultaneously after video ends
            transitionVideo.onended = () => {
                transitionVideo.style.opacity = '0'; // Start fading out video

                // Directly fade in chat elements
                document.getElementById('X').style.display = 'block';
                document.getElementById('chat-area').style.display = 'block';
                document.getElementById('chat-area').style.opacity = '1';
                document.getElementById('bubble').style.display = 'block';
                document.getElementById('chart').style.display = 'block';
                document.getElementById('hold').style.display = 'block';

                document.getElementById("bubble").setAttribute("src", `https://trench.bot/bundles/${roomId}`);
                document.getElementById("chart").setAttribute("src", `https://www.solanatracker.io/chart/embed/${roomId}`);

                const messagesList = document.getElementById('messages');
                data.messageHistory.forEach(msg => {
                    displayMessage(`<b>${msg.user}:</b> ${msg.message}`);
                });

                updateMarketCap();
                intervalId = setInterval(updateMarketCap, 5000);

                // Hide video after fade out (optional: if you want to ensure it disappears after the fade)
                setTimeout(() => {
                    transitionVideo.style.display = 'none';
                }, 500); // Match CSS transition duration
            };
        }, 500); // Match CSS transition duration
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

    // Limit to 30 messages
    while (messagesList.children.length > 30) {
        messagesList.removeChild(messagesList.firstChild);
    }

    messagesList.scrollTop = messagesList.scrollHeight;
}

document.getElementById('message-input').addEventListener('keyup', (event) => {
    if (event.key === 'Enter') {
        sendMessage();
    }
});

