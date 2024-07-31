import OpenAI from "openai";

const openai = new OpenAI();

let chatHistory = [{
  role: "system",
  content: `You are an assistant helping customers order school supplies and check availability. Your goal is to respond to user inquiries and generate proper json format at the end of your response similar to examples below.

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

Now, please respond to user inquiries accordingly. and put the json at the end of your response`
}];

let inventory = {
  pen: 30,
  pencil: 30,
  notebook: 30
};

export default async function handler(req, res) {
  const { method } = req;

  switch (method) {
    case "POST":
      if (req.query.endpoint === "chat") {
        const content = req.body.message;
        chatHistory.push({ role: "user", content: content });

        res.status(200).json({ success: true });
      } else if (req.query.endpoint === "reset") {
        chatHistory = [{
          role: "system",
          content: `You are an assistant helping customers order school supplies and check availability. Your goal is to respond to user inquiries and generate proper JSON at the end of your response.

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

Now, please respond to user inquiries accordingly. and put the json at the end of your response`
        }];
        inventory = {
          pen: 30,
          pencil: 30,
          notebook: 30
        };
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

            // Detect if the buffer contains a complete JSON object
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

                buffer = buffer.substring(jsonEnd + 1); // Clear the processed part
              } catch (e) {
                // Continue if JSON is not yet complete
              }
            }

            res.write(`data: ${JSON.stringify({ message, inventory })}\n\n`);
          }

          const chatCompletion = await stream.finalChatCompletion();
        } catch (error) {
          res.write(
            "event: error\ndata: " +
            JSON.stringify({ message: "Stream encountered an error" }) +
            "\n\n"
          );
        }

        return new Promise((resolve) => {
          req.on("close", () => {
            resolve();
          });
        });
      } else {
        res.status(404).json({ error: "Not Found" });
      }
      break;
    default:
      res.setHeader("Allow", ["GET", "POST"]);
      res.status(405).end(`Method ${method} Not Allowed`);
  }
}
