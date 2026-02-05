import { SerialPort } from "serialport";
import { ReadlineParser } from "@serialport/parser-readline";
import { createClient } from "@supabase/supabase-js";

const port = new SerialPort({ path: "COM4", baudRate: 115200 });
const parser = port.pipe(new ReadlineParser({ delimiter: "\n" }));

const supabase = createClient(
  "https://YOUR_PROJECT_ID.supabase.co",
  "YOUR_ANON_KEY"
);

parser.on("data", async (line) => {
  console.log("Received:", line);

  const [hr, temp, sweat, state] = line.split(",");

  await supabase.from("health_data").insert({
    heart_rate: parseInt(hr),
    temperature: parseFloat(temp),
    sweat: parseInt(sweat),
    state: parseInt(state)
  });

  console.log("Uploaded to Supabase ✅");
});