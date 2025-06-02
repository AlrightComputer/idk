import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';

const App = () => {
  const mediaRecorder = useRef(null);
  const audioChunks = useRef([]);
  const audioPlayer = useRef(null);

  const [blobURL, setBlobUrl] = useState("");
  const [audioFile, setAudioFile] = useState(null);
  const [isRecording, setIsRecording] = useState(false);

  const [conversation, setConversation] = useState([]);
  const [transcript, setTranscript] = useState("");

  const [uploadURL, setUploadURL] = useState("");
  const [transcriptID, setTranscriptID] = useState("");
  const [transcriptData, setTranscriptData] = useState(null);

  const assembly = axios.create({
    baseURL: "https://api.assemblyai.com/v2",
    headers: {
      authorization: "ASSEMBLYAI_API_KEY",
      "content-type": "application/json",
    },
  });

  useEffect(() => {
    if (audioFile) {
      assembly.post("/upload", audioFile)
        .then(res => setUploadURL(res.data.upload_url))
        .catch(err => console.error(err));
    }
  }, [audioFile]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (transcriptID) {
        assembly.get(`/transcript/${transcriptID}`)
          .then(res => {
            if (res.data.status === 'completed') {
              clearInterval(interval);
              setTranscript(res.data.text);
              setTranscriptData(res.data);
            }
          })
          .catch(err => console.error(err));
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [transcriptID]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunks.current = [];

      mediaRecorder.current = new MediaRecorder(stream);
      mediaRecorder.current.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunks.current.push(e.data);
      };
      mediaRecorder.current.onstop = () => {
        const blob = new Blob(audioChunks.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(blob);
        const file = new File([blob], "audio.webm", { type: "audio/webm" });
        setBlobUrl(url);
        setAudioFile(file);
        setIsRecording(false);
      };

      mediaRecorder.current.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Mic access denied or error:", err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorder.current && mediaRecorder.current.state !== "inactive") {
      mediaRecorder.current.stop();
    }
  };

  const submitTranscription = () => {
    if (!uploadURL) return;
    assembly.post("/transcript", { audio_url: uploadURL })
      .then(res => setTranscriptID(res.data.id))
      .catch(err => console.error(err));
  };

  useEffect(() => {
    if (transcriptData && transcriptData.status === 'completed') {
      setConversation(prev => [...prev, { sender: "user", text: transcript }]);

      const payload = {
        model: "gpt-4",
        messages: [{ role: "user", content: transcript }]
      };
      axios.post("https://api.openai.com/v1/chat/completions", payload, {
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer OPENAI_API_KEY`
        }
      }).then(res => {
        const reply = res.data.choices[0].message.content;
        setConversation(prev => [...prev, { sender: "bot", text: reply }]);
        const utterance = new SpeechSynthesisUtterance(reply);
        window.speechSynthesis.speak(utterance);
      }).catch(err => console.error(err));
    }
  }, [transcriptData, transcript]);

  return (
    <div className="container mx-auto max-w-md p-4">
      <h1 className="text-2xl font-bold mb-4">AI Voice Assistant</h1>

      <audio ref={audioPlayer} src={blobURL} controls className="mb-4 w-full" />
      <div className="flex space-x-2 mb-4">
        <button onClick={startRecording} disabled={isRecording}
          className="bg-blue-500 text-white px-4 py-2 rounded">Start</button>
        <button onClick={stopRecording} disabled={!isRecording}
          className="bg-red-500 text-white px-4 py-2 rounded">Stop</button>
        <button onClick={submitTranscription}
          className="bg-green-500 text-white px-4 py-2 rounded">Submit</button>
      </div>

      <div className="space-y-2">
        {conversation.map((msg, idx) => (
          <div key={idx} className={`p-2 rounded ${
              msg.sender === "user" ? "bg-blue-100 text-right" : "bg-gray-100 text-left"}`}>
            <strong>{msg.sender === "user" ? "You: " : "Bot: "}</strong>
            <span>{msg.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default App;
