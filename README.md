# OpenAI API sale integration

This quickstart app builds on top of the example code above, with streaming and a UI to visualize messages.

## Setup

1. If you don’t have Node.js installed, install it from [nodejs.org](https://nodejs.org/en/) (Node.js version >= 16.0.0 required)

2. Clone this repository

3. Navigate into the project directory

   ```bash
   $ cd openai-quickstart-node
   ```

4. Install the requirements

   ```bash
   $ npm install
   ```

5. Make a copy of the example environment variables file

   On Linux systems:

   ```bash
   $ cp .env.example .env
   ```

   On Windows:

   ```powershell
   $ copy .env.example .env
   ```

6. Add your [API key](https://platform.openai.com/account/api-keys) to the newly created `.env` file

7. Run the app

   ```bash
   $ npm run dev
   ```

You should now be able to access the app at [http://localhost:3000](http://localhost:3000)! For the full context behind this example app, check out the [tutorial](https://platform.openai.com/docs/quickstart).

How the Code Works
This application helps customers order school supplies and check availability through an interactive chat interface. It includes backend and frontend components to handle user inquiries and update inventory in real-time.

Backend (pages/api/generate.js)
The backend processes chat messages, manages inventory, and streams responses to the frontend.

Initialization:

javascript
Copy code
import OpenAI from "openai";
const openai = new OpenAI();

let chatHistory = [{ role: "system", content: `...system prompt...` }];
let inventory = { pen: 30, pencil: 30, notebook: 30 };
Request Handler:

javascript
Copy code
export default async function handler(req, res) {
const { method } = req;
switch (method) {
case "POST":
if (req.query.endpoint === "chat") {
const content = req.body.message;
chatHistory.push({ role: "user", content });
res.status(200).json({ success: true });
} else if (req.query.endpoint === "reset") {
chatHistory = [{ role: "system", content: `...system prompt...` }];
inventory = { pen: 30, pencil: 30, notebook: 30 };
res.status(200).json({ success: true });
} else {
res.status(404).json({ error: "Not Found" });
}
break;
case "GET":
if (req.query.endpoint === "history") {
res.status(200).json(chatHistory);
} else if (req.query.endpoint === "stream") {
res.setHeader("Content-Type", "text/event-stream");
res.setHeader("Cache-Control", "no-cache");
res.setHeader("Connection", "keep-alive");

        try {
          const stream = await openai.beta.chat.completions.stream({
            model: "gpt-4-turbo",
            messages: chatHistory,
            stream: true,
          });

          let buffer = "";
          for await (const chunk of stream) {
            const message = chunk.choices[0]?.delta?.content || "";
            buffer += message;

            const jsonStart = buffer.indexOf("{");
            const jsonEnd = buffer.indexOf("}");
            if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
              const jsonString = buffer.substring(jsonStart, jsonEnd + 1);
              try {
                const jsonObject = JSON.parse(jsonString);
                console.log("Extracted JSON:", jsonObject);

                if (jsonObject.action === "order") {
                  const { item, quantity } = jsonObject;
                  if (inventory[item] !== undefined && inventory[item] >= quantity) {
                    inventory[item] -= quantity;
                    console.log("Updated Inventory:", inventory);
                  } else {
                    console.log(`Insufficient stock for ${item}. Available: ${inventory[item]}`);
                  }
                } else if (jsonObject.action === "check_availability") {
                  const { item } = jsonObject;
                  console.log(`Availability of ${item}: ${inventory[item]}`);
                }
                buffer = buffer.substring(jsonEnd + 1);
              } catch (e) {
                // Continue if JSON is not yet complete
              }
            }
            res.write(`data: ${JSON.stringify({ message, inventory })}\n\n`);
          }
          await stream.finalChatCompletion();
        } catch (error) {
          res.write("event: error\ndata: " + JSON.stringify({ message: "Stream encountered an error" }) + "\n\n");
        }
        return new Promise((resolve) => req.on("close", resolve));
      } else {
        res.status(404).json({ error: "Not Found" });
      }
      break;
    default:
      res.setHeader("Allow", ["GET", "POST"]);
      res.status(405).end(`Method ${method} Not Allowed`);

}
}
Frontend (pages/index.js)
The frontend displays the chat interface, sends messages, and updates the chat history and inventory in real-time.

Initialization and State Management:

javascript
Copy code
import Head from "next/head";
import { useState, useEffect, useRef } from "react";
import styles from "./index.module.css";

const icons = { pen: "🖊️", pencil: "✏️", notebook: "📓" };

export default function Home() {
const [message, setMessage] = useState("");
const [chatHistory, setChatHistory] = useState([ /* initial system prompt */ ]);
const [inventory, setInventory] = useState({ pen: 30, pencil: 30, notebook: 30 });
const chatContainerRef = useRef(null);

useEffect(() => {
if (chatContainerRef.current) {
chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
}
}, [chatHistory]);
Handle JSON Responses (handleJSONResponse):
Processes JSON responses, updates chat history, and modifies the inventory.

javascript
Copy code
const handleJSONResponse = (jsonString) => {
try {
const jsonObject = JSON.parse(jsonString);
if (jsonObject.action === "order") {
if (inventory[jsonObject.item] !== undefined) {
if (inventory[jsonObject.item] >= jsonObject.quantity) {
setChatHistory((prevChatHistory) => [
...prevChatHistory,
{ role: "assistant", content: `Order placed for ${jsonObject.quantity} ${jsonObject.item}(s).` },
]);
setInventory((prevInventory) => ({
...prevInventory,
[jsonObject.item]: prevInventory[jsonObject.item] - jsonObject.quantity,
}));
} else {
setChatHistory((prevChatHistory) => [
...prevChatHistory,
{ role: "assistant", content: `Sorry, we only have ${inventory[jsonObject.item]} ${jsonObject.item}(s) left.` },
]);
}
} else {
setChatHistory((prevChatHistory) => [
...prevChatHistory,
{ role: "assistant", content: `Sorry, we do not have ${jsonObject.item}(s) in stock.` },
]);
}
} else if (jsonObject.action === "check_availability") {
if (inventory[jsonObject.item] !== undefined) {
setChatHistory((prevChatHistory) => [
...prevChatHistory,
{ role: "assistant", content: `We have ${inventory[jsonObject.item]} ${jsonObject.item}(s) in stock.` },
]);
} else {
setChatHistory((prevChatHistory) => [
...prevChatHistory,
{ role: "assistant", content: `Sorry, we do not have ${jsonObject.item}(s) in stock.` },
]);
}
}
} catch (error) {
console.error("Failed to parse JSON string:", jsonString);
}
};
Send Messages (sendMessage):
Sends user messages to the backend, handles streaming responses, and updates the frontend.

javascript
Copy code
const sendMessage = async (message) => {
setChatHistory((prev) => [...prev, { role: "user", content: message }]);

const response = await fetch("/api/generate?endpoint=chat", {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({ message }),
});

const data = await response.json();
if (data.success) {
const eventSource = new EventSource("/api/generate?endpoint=stream");

    let buffer = "";
    let jsonStarted = false;

    eventSource.onmessage = function (event) {
      const parsedData = JSON.parse(event.data);
      const { message, inventory: updatedInventory } = parsedData;

      buffer += message;

      const jsonStart = buffer.indexOf("{");
      if (jsonStart !== -1) jsonStarted = true;

      if (!jsonStarted) {
        setChatHistory((prevChatHistory) => {
          const newChatHistory = [...prevChatHistory];
          if (
            newChatHistory.length > 0 &&
            newChatHistory[newChatHistory.length - 1].role === "assistant"
          ) {
            newChatHistory[newChatHistory.length - 1].content += message;
          } else {
            newChatHistory.push({ role: "assistant", content: message });
          }
          return newChatHistory;
        });
      }

      if (jsonStarted) {
        const jsonEnd = buffer.indexOf("}");
        if (jsonEnd !== -1) {
          const jsonString = buffer.substring(jsonStart, jsonEnd + 1);
          handleJSONResponse(jsonString);
          buffer = buffer.substring(jsonEnd + 1); // Clear the processed part
        }
      }
      setInventory(updatedInventory);
    };

    eventSource.onerror = function () {
      eventSource.close();
    };

}
};
