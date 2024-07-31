import Head from "next/head";
import { useState, useEffect, useRef } from "react";
import styles from "./index.module.css";

// Icons for the inventory items
const icons = {
  pen: "🖊️",
  pencil: "✏️",
  notebook: "📓",
};

export default function Home() {
  const [message, setMessage] = useState("");
  const [chatHistory, setChatHistory] = useState([
    { role: "system", content: `You are an assistant helping customers order school supplies and check availability. Your goal is to respond to user inquiries and generate proper JSON at the end of your response.

    When a user asks about availability, you should respond with a message indicating you are checking availability and generate a JSON object like:
    {
      "action": "check_availability",
      "item": "pencil"
    }
    
    When a user wants to place an order, respond with a confirmation message and generate a JSON object like:
    {
      "action": "order",
      "item": "pencil",
      "quantity": 3
    }
    
    Examples:
    User: "Can you check the availability of pencils?"
    Assistant: "Let me check the availability of pencils for you."
    {
      "action": "check_availability",
      "item": "pencil"
    }
    
    User: "I would like to order 3 pencils."
    Assistant: "I'll place an order for 3 pencils."
    {
      "action": "order",
      "item": "pencil",
      "quantity": 3
    }
    
    Now, please respond to user inquiries accordingly. and put the json at the end of your response` },
  ]);
  const [inventory, setInventory] = useState({
    pen: 30,
    pencil: 30,
    notebook: 30,
  });
  const chatContainerRef = useRef(null);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatHistory]);

  const handleJSONResponse = (jsonString) => {
    try {
      const jsonObject = JSON.parse(jsonString);
      console.log("Extracted JSON:", jsonObject);

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

  const sendMessage = async (message) => {
    // Add the user's message to the chat history
    setChatHistory((prev) => [...prev, { role: "user", content: message }]);
  
    // Send the user's message to the backend API
    const response = await fetch("/api/generate?endpoint=chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ message }),
    });
  
    // Check if the API call was successful
    const data = await response.json();
    if (data.success) {
      // Initialize an EventSource to receive streaming responses from the backend
      const eventSource = new EventSource("/api/generate?endpoint=stream");
  
      // Buffer to accumulate streamed data
      let buffer = "";
      let jsonStarted = false;
  
      // Handle incoming messages from the EventSource
      eventSource.onmessage = function (event) {
        // Parse the incoming data
        const parsedData = JSON.parse(event.data);
        const { message, inventory: updatedInventory } = parsedData;
  
        // Accumulate the message content
        buffer += message;
  
        // Detect the start of a JSON object
        const jsonStart = buffer.indexOf("{");
        if (jsonStart !== -1) {
          jsonStarted = true;
        }
  
        // If JSON has not started yet, update the chat history with the streamed message
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
  
        // Detect the end of a JSON object
        if (jsonStarted) {
          const jsonEnd = buffer.indexOf("}");
          if (jsonEnd !== -1) {
            const jsonString = buffer.substring(jsonStart, jsonEnd + 1);
            handleJSONResponse(jsonString);
            buffer = buffer.substring(jsonEnd + 1); // Clear the processed part
          }
        }
  
        // Update the inventory state with the received data
        setInventory(updatedInventory);
      };
  
      // Handle errors with the EventSource
      eventSource.onerror = function () {
        eventSource.close();
      };
    }
  };
  

  const clearChat = async () => {
    setChatHistory([
      { role: "system", content: `You are an assistant helping customers order school supplies and check availability. Your goal is to respond to user inquiries and generate proper JSON at the end of your response.

      When a user asks about availability, you should respond with a message indicating you are checking availability and generate a JSON object like:
      {
        "action": "check_availability",
        "item": "pencil"
      }
      
      When a user wants to place an order, respond with a confirmation message and generate a JSON object like:
      {
        "action": "order",
        "item": "pencil",
        "quantity": 3
      }
      
      Examples:
      User: "Can you check the availability of pencils?"
      Assistant: "Let me check the availability of pencils for you."
      {
        "action": "check_availability",
        "item": "pencil"
      }
      
      User: "I would like to order 3 pencils."
      Assistant: "I'll place an order for 3 pencils."
      {
        "action": "order",
        "item": "pencil",
        "quantity": 3
      }
      
      Now, please respond to user inquiries accordingly. and put the json at the end of your response` },
    ]);
    setInventory({
      pen: 30,
      pencil: 30,
      notebook: 30,
    });

    await fetch("/api/generate?endpoint=reset", { method: "POST" });
  };

  const onSubmit = (event) => {
    event.preventDefault();
    if (!message.trim()) return;
    sendMessage(message.trim());
    setMessage("");
  };

  return (
    <div>
      <Head>
        <title>Sale integration</title>
      </Head>
      <h1 className={styles.heading1}>Sale Integration</h1>
      <div className={styles.container}>
        <div className={styles.inventoryContainer}>
          <h2>Inventory</h2>
          <ul>
            {Object.keys(inventory).map((item) => (
              <li key={item} className={styles.inventoryItem}>
                <span className={styles.inventoryIcon}>{icons[item]}</span>
                {item.charAt(0).toUpperCase() + item.slice(1)}: {inventory[item]}
              </li>
            ))}
          </ul>
        </div>
        <div className={styles.chatContainer} ref={chatContainerRef}>
          {chatHistory.map((msg, index) => (
            <div
              key={index}
              className={
                msg.role === "user" ? styles.userMessage : styles.assistantMessage
              }
            >
              {msg.content}
            </div>
          ))}
        </div>
      </div>
      <div className={styles.messageInputContainer}>
        <form onSubmit={onSubmit}>
          <textarea
            className={styles.textarea}
            name="message"
            placeholder="Type your message here..."
            required
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          ></textarea>
          <div className={styles.buttonGroup}>
            <input className={styles.inputSubmit} type="submit" value="Send" />
            <button
              className={styles.inputButton}
              type="button"
              onClick={clearChat}
            >
              Clear
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
