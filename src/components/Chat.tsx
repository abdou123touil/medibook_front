
import React, { useState, useEffect, useRef } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Send, X, MessageCircle, Bot, CheckCheck } from "lucide-react";
import { useAuthStore } from "../store/auth";
import clsx from "clsx";
import io from "socket.io-client";

interface Message {
  _id: string;
  content: string;
  senderId: {
    _id: string;
    firstName: string;
    lastName: string;
  };
  receiverId: {
    _id: string;
    firstName: string;
    lastName: string;
  };
  createdAt: string;
  conversationId: string;
  appointmentId?: string;
  readAt?: string | null;
}

interface Appointment {
  _id: string;
  doctorId: {
    _id: string;
    firstName: string;
    lastName: string;
  };
  patientId:
    | string
    | {
        _id: string;
        firstName: string;
        lastName: string;
      };
  status: string;
  date: string;
  time: string;
}

interface Conversation {
  conversationId: string;
  lastMessage?: Message;
  unreadCount: number;
  participants: Array<{
    _id: string;
    firstName: string;
    lastName: string;
  }>;
  latestAppointment?: Appointment;
  isBot?: boolean;
}

interface ChatProps {
  onClose: () => void;
}

export function Chat({ onClose }: ChatProps) {
  const { user } = useAuthStore();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] =
    useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isBotTyping, setIsBotTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<any>(null);
  const chatRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const token = localStorage.getItem("token");
    console.log("Token:", token);
    console.log("User data:", user?.data?.id);
    const loadData = async () => {
      if (!user?.data?.id || !token) {
        console.error("User ID or token missing");
        return;
      }

      try {
        const [appointmentsRes, convResponse] = await Promise.all([
          fetch(`http://localhost:3000/api/appointments/`, {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          }),
          fetch(`http://localhost:3000/api/chat/user/${user.data.id}`),
        ]);

        const appointmentsData = await appointmentsRes.json();
        console.log("Appointments response:", appointmentsData);

        const appointments: Appointment[] = appointmentsRes.ok
          ? appointmentsData.appointments || []
          : [];

        const apiConversations: Conversation[] = convResponse.ok
          ? await convResponse.json()
          : [];

        const appointmentConversations = appointments.reduce(
          (acc, appointment) => {
            const otherUser = getOtherUserFromAppointment(appointment);
            const conversationId = `conv_${[user.data.id, otherUser._id]
              .sort()
              .join("_")}`;
            console.log(`Generated conversationId: ${conversationId}`);

            const existing = acc.find(
              (c) => c.conversationId === conversationId
            );

            if (existing) {
              const appointmentDate = new Date(appointment.date);
              const existingDate = new Date(
                existing.latestAppointment?.date || 0
              );
              if (appointmentDate > existingDate) {
                existing.latestAppointment = appointment;
              }
            } else {
              acc.push({
                conversationId,
                participants: [otherUser],
                unreadCount: 0,
                latestAppointment: appointment,
                lastMessage: undefined,
              });
            }
            return acc;
          },
          [] as Conversation[]
        );

        const botConversation: Conversation = {
          conversationId: "bot_medical_advisor",
          participants: [
            {
              _id: "bot_medical_advisor",
              firstName: "MediBot",
              lastName: "IA",
            },
          ],
          unreadCount: 0,
          isBot: true,
          lastMessage: {
            _id: "bot_welcome",
            content:
              "Bonjour ! Je suis MediBot, votre assistant médical IA. Posez-moi vos questions médicales pour des conseils rapides et précis !",
            senderId: {
              _id: "bot_medical_advisor",
              firstName: "MediBot",
              lastName: "IA",
            },
            receiverId: {
              _id: user.data.id,
              firstName: user.data.firstName,
              lastName: user.data.lastName,
            },
            createdAt: new Date().toISOString(),
            conversationId: "bot_medical_advisor",
            readAt: null,
          },
        };

        const merged = [
          botConversation,
          ...apiConversations,
          ...appointmentConversations,
        ].reduce((acc, conv) => {
          const existing = acc.find(
            (c) => c.conversationId === conv.conversationId
          );
          if (existing) {
            if (
              conv.lastMessage &&
              (!existing.lastMessage ||
                new Date(conv.lastMessage.createdAt) >
                  new Date(existing.lastMessage.createdAt))
            ) {
              existing.lastMessage = conv.lastMessage;
            }
            if (
              conv.latestAppointment &&
              (!existing.latestAppointment ||
                new Date(conv.latestAppointment.date) >
                  new Date(existing.latestAppointment.date))
            ) {
              existing.latestAppointment = conv.latestAppointment;
            }
            existing.unreadCount += conv.unreadCount;
          } else {
            acc.push(conv);
          }
          return acc;
        }, [] as Conversation[]);

        console.log("Loaded conversations:", merged);
        setConversations(merged);
      } catch (error) {
        console.error("Error loading data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [user]);

  const getOtherUserFromAppointment = (appointment: Appointment) => {
    const isDoctor = user?.data?.role === "doctor";
    if (isDoctor) {
      return typeof appointment.patientId === "string"
        ? { _id: appointment.patientId, firstName: "Patient", lastName: "" }
        : appointment.patientId;
    }
    return appointment.doctorId;
  };

  const getOtherUserFromConversation = (conversation: Conversation) => {
    return conversation.participants.find((p) => p._id !== user?.data?.id);
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (chatRef.current && !chatRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [onClose]);

  useEffect(() => {
    const socket = io("http://localhost:3000", {
      withCredentials: true,
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("Socket.IO connected:", socket.id);
    });

    socket.on("disconnect", () => {
      console.log("Socket.IO disconnected");
    });

    socket.on("connect_error", (err) => {
      console.error("Socket.IO connection error:", err);
    });

    socket.on("newMessage", (message: Message) => {
      console.log("Received newMessage:", JSON.stringify(message, null, 2));
      if (!message.conversationId) {
        console.error("Received message with undefined conversationId:", message);
        const generatedConversationId = `conv_${[
          message.senderId._id,
          message.receiverId._id,
        ]
          .sort()
          .join("_")}`;
        console.log("Generated fallback conversationId:", generatedConversationId);
        message.conversationId = generatedConversationId;
      }
      if (selectedConversation?.conversationId === message.conversationId) {
        setMessages((prev) => {
          if (prev.some((msg) => msg._id === message._id)) {
            console.log(`Duplicate message ignored: ${message._id}`);
            return prev;
          }
          console.log("Adding new message to state:", message._id);
          return [...prev, message];
        });
        if (message.senderId._id === "bot_medical_advisor") {
          setIsBotTyping(false);
        }
      } else {
        console.log(
          `Message ignored: not for selected conversation ${selectedConversation?.conversationId}`
        );
      }

      setConversations((prev) =>
        prev.map((conv) => {
          if (conv.conversationId === message.conversationId) {
            const isReceiver = message.receiverId._id === user?.data?.id;
            return {
              ...conv,
              lastMessage: message,
              unreadCount: isReceiver ? conv.unreadCount + 1 : conv.unreadCount,
            };
          }
          return conv;
        })
      );

      if (
        selectedConversation?.conversationId === message.conversationId &&
        message.receiverId._id === user?.data?.id
      ) {
        socket.emit("markAsRead", {
          conversationId: message.conversationId,
          userId: user?.data?.id,
        });
      }
    });

    socket.on("messagesRead", (updatedMessages: Message[]) => {
      console.log(
        "Received messagesRead:",
        updatedMessages.map((msg) => ({ _id: msg._id, readAt: msg.readAt }))
      );
      setMessages((prev) =>
        prev.map((msg) => {
          const updatedMsg = updatedMessages.find((u) => u._id === msg._id);
          return updatedMsg || msg;
        })
      );
    });

    return () => {
      socket.disconnect();
    };
  }, [user?.data?.id, selectedConversation]);

  useEffect(() => {
    if (conversations.length > 0 && socketRef.current && socketRef.current.connected) {
      conversations.forEach((conv) => {
        socketRef.current.emit("joinConversation", conv.conversationId);
        console.log(`Joined conversation: ${conv.conversationId}`);
      });
    }
  }, [conversations]);

  useEffect(() => {
    if (selectedConversation && user?.data?.id) {
      const otherUser = getOtherUserFromConversation(selectedConversation);
      if (!otherUser) return;

      const loadMessages = async () => {
        try {
          setIsLoading(true);
          if (selectedConversation.isBot) {
            setMessages([
              {
                _id: "bot_welcome",
                content:
                  "Bonjour ! Je suis MediBot, votre assistant médical IA. Posez-moi vos questions médicales pour des conseils rapides et précis !",
                senderId: {
                  _id: "bot_medical_advisor",
                  firstName: "MediBot",
                  lastName: "IA",
                },
                receiverId: {
                  _id: user.data.id,
                  firstName: user.data.firstName,
                  lastName: user.data.lastName,
                },
                createdAt: new Date().toISOString(),
                conversationId: "bot_medical_advisor",
                readAt: null,
              },
            ]);
          } else {
            const response = await fetch(
              `http://localhost:3000/api/chat/conversation/${user.data.id}/${otherUser._id}`
            );

            if (!response.ok) {
              const errorData = await response.json();
              throw new Error(errorData.error || "Failed to load messages");
            }

            const data = await response.json();
            setMessages(data);
          }
        } catch (error) {
          console.error("Error loading messages:", error);
        } finally {
          setIsLoading(false);
        }
      };

      loadMessages();

      if (!selectedConversation.isBot && socketRef.current) {
        socketRef.current.emit("joinConversation", selectedConversation.conversationId);
        console.log(`Re-joined conversation on selection: ${selectedConversation.conversationId}`);
        socketRef.current.emit("markAsRead", {
          conversationId: selectedConversation.conversationId,
          userId: user.data.id,
        });
      }
    } else {
      setMessages([]);
      setIsLoading(false);
    }
  }, [selectedConversation, user]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedConversation || !newMessage.trim() || !user?.data?.id) return;

    const otherUser = getOtherUserFromConversation(selectedConversation);
    if (!otherUser) return;

    try {
      if (selectedConversation.isBot) {
        const botMessage: Message = {
          _id: `user_${Date.now()}`,
          content: newMessage,
          senderId: {
            _id: user.data.id,
            firstName: user.data.firstName,
            lastName: user.data.lastName,
          },
          receiverId: {
            _id: "bot_medical_advisor",
            firstName: "MediBot",
            lastName: "IA",
          },
          createdAt: new Date().toISOString(),
          conversationId: "bot_medical_advisor",
          readAt: null,
        };

        setMessages((prev) => {
          if (prev.some((msg) => msg._id === botMessage._id)) {
            console.log(`Duplicate bot message ignored: ${botMessage._id}`);
            return prev;
          }
          return [...prev, botMessage];
        });
        setNewMessage("");
        setIsBotTyping(true);

        console.log("Sending botMessage:", {
          message: newMessage,
          userId: user.data.id,
          conversationId: "bot_medical_advisor",
        });
        socketRef.current.emit("botMessage", {
          message: newMessage,
          userId: user.data.id,
          conversationId: "bot_medical_advisor",
        });
      } else {
        const response = await fetch("http://localhost:3000/api/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${user.data.token}`,
          },
          body: JSON.stringify({
            senderId: user.data.id,
            receiverId: otherUser._id,
            content: newMessage,
            appointmentId: selectedConversation.latestAppointment?._id,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Message send failed");
        }

        const savedMessage = await response.json();
        setMessages((prev) => {
          if (prev.some((msg) => msg._id === savedMessage._id)) {
            console.log(`Duplicate message ignored: ${savedMessage._id}`);
            return prev;
          }
          console.log("Adding saved message to state:", savedMessage._id);
          return [...prev, savedMessage];
        });
        setNewMessage("");

        setConversations((prev) =>
          prev.map((conv) =>
            conv.conversationId === selectedConversation.conversationId
              ? { ...conv, lastMessage: savedMessage }
              : conv
          )
        );
      }
    } catch (error) {
      console.error("Error sending message:", error);
      alert("Erreur lors de l'envoi du message. Veuillez réessayer.");
      setIsBotTyping(false);
    }
  };

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  return (
    <div
      ref={chatRef}
      className="flex flex-col h-[600px] bg-white dark:bg-gray-800 rounded-xl shadow-lg"
    >
      <div className="flex flex-1 overflow-hidden">
        {/* Liste des conversations */}
        <div className="w-1/3 border-r dark:border-gray-700 overflow-y-auto">
          {conversations.map((conversation) => {
            const otherUser = getOtherUserFromConversation(conversation);
            const lastMessageDate =
              conversation.lastMessage?.createdAt ||
              conversation.latestAppointment?.date;

            return (
              <button
                key={conversation.conversationId}
                onClick={() => setSelectedConversation(conversation)}
                className={clsx(
                  "w-full p-4 text-left hover:bg-gray-100 dark:hover:bg-gray-700",
                  selectedConversation?.conversationId ===
                    conversation.conversationId &&
                    "border-r dark:border-gray-700 bg-gray-100 dark:bg-gray-700",
                  conversation.isBot && "bg-indigo-50 dark:bg-indigo-900"
                )}
              >
                <div className="flex items-center gap-3">
                  {conversation.isBot ? (
                    <Bot className="w-5 h-5 text-indigo-600" />
                  ) : (
                    <MessageCircle className="w-5 h-5" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">
                      {otherUser?.firstName} {otherUser?.lastName}
                    </p>
                    <p className="text-sm text-gray-500 truncate">
                      {conversation.lastMessage?.content ||
                        (conversation.isBot
                          ? "Assistant médical IA"
                          : "Nouveau rendez-vous")}
                    </p>
                    <div className="flex justify-between items-center mt-1">
                      <p className="text-xs text-gray-400">
                        {lastMessageDate
                          ? format(
                              new Date(lastMessageDate),
                              "dd/MM/yyyy HH:mm"
                            )
                          : "Aucun message"}
                      </p>
                      {conversation.unreadCount > 0 && (
                        <span className="bg-indigo-600 text-white rounded-full px-2 py-1 text-xs">
                          {conversation.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                  </div>
                </button>
              
            );
          })}
        
        </div>

        {/* Fenêtre de chat */}
        <div className="flex-1 flex flex-col">
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          >
            <X className="w-6 h-6" />
          </button>
          {selectedConversation ? (
            <>
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {isLoading ? (
                  <div className="flex justify-center items-center h-full">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                  </div>
                ) : (
                  <>
                    {messages.map((message) => (
                      <div
                        key={message._id}
                        className={clsx(
                          "max-w-[80%] rounded-lg p-3",
                          message.senderId._id === user?.data?.id
                            ? "ml-auto bg-indigo-600 text-white"
                            : "bg-gray-100 dark:bg-gray-700",
                          message.senderId._id === user?.data?.id &&
                            message.readAt &&
                            "opacity-80"
                        )}
                      >
                        <p className="break-words">{message.content}</p>
                        <div className="flex items-center justify-between mt-1">
                          <p
                            className={clsx(
                              "text-xs",
                              message.senderId._id === user?.data?.id
                                ? "text-indigo-200"
                                : "text-gray-500 dark:text-gray-400"
                            )}
                          >
                            {format(new Date(message.createdAt), "HH:mm", {
                              locale: fr,
                            })}
                          </p>
                          {message.senderId._id === user?.data?.id && (
                            <CheckCheck
                              className={clsx(
                                "w-4 h-4",
                                message.readAt
                                  ? "text-green-400"
                                  : "text-indigo-200"
                              )}
                              title={message.readAt ? "Vu" : "Envoyé"}
                            />
                          )}
                        </div>
                      </div>
                    ))}
                    {isBotTyping && selectedConversation.isBot && (
                      <div className="max-w-[80%] rounded-lg p-3 bg-gray-100 dark:bg-gray-700">
                        <p className="text-gray-500 animate-pulse">
                          MediBot est en train de taper...
                        </p>
                      </div>
                    )}
                  </>
                )}
                <div ref={messagesEndRef} />
              </div>

              <form
                onSubmit={sendMessage}
                className="p-4 border-t dark:border-gray-700"
              >
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder={
                      selectedConversation.isBot
                        ? "Posez une question médicale..."
                        : "Écrivez votre message..."
                    }
                    className="flex-1 px-4 py-2 border dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-700"
                  />
                  <button
                    type="submit"
                    disabled={!newMessage.trim() || isBotTyping}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Send className="w-5 h-5" />
                  </button>
                </div>
              </form>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500">
              Sélectionnez une conversation
            </div>
          )}
        </div>
      </div>
    </div>
    
  );
}
