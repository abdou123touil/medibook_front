import React, { useEffect, useState } from "react";
import {
  Star,
  MessageCircle,
  X,
  ThumbsUp,
  Heart,
  ThumbsDown,
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { motion } from "framer-motion";
import toast from 'react-hot-toast';

interface Review {
  _id: string;
  patientName: string;
  rating: number;
  comment: string;
  date: string;
  helpful?: number;
  reactions?: { [key: string]: number };
}

interface ReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  doctorId: string;
}

export function ReviewModal({ isOpen, onClose, doctorId }: ReviewModalProps) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [newReview, setNewReview] = useState({ rating: 0, comment: "" });
  const [loading, setLoading] = useState<boolean>(false);
  const [reactionCounts, setReactionCounts] = useState<
    Record<string, Record<string, number>>
  >({});

  // Fetch reviews when modal is opened
  useEffect(() => {
    if (!isOpen) return;

    setLoading(true);
    const token = localStorage.getItem("token");

    if (!token) {
      console.error("No token found in localStorage.");
      toast.error("Veuillez vous connecter pour voir les avis.");
      setLoading(false);
      return;
    }

    console.log("Fetching reviews for doctorId:", doctorId);
    fetch(`http://localhost:3000/api/reviews/doctor/${doctorId}`, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    })
      .then((response) => {
        console.log("Response status:", response.status);
        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
        return response.json();
      })
      .then(async (data) => {
        console.log("Fetched reviews data:", data);
        setReviews(data);

        if (data.length === 0) {
          setLoading(false);
          return;
        }

        const fetchedReactions: Record<string, Record<string, number>> = {};

        await Promise.all(
          data.map((review: Review) =>
            fetch(`http://localhost:3000/api/reactions/review/${review._id}`, {
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
            })
              .then((response) => {
                if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
                return response.json();
              })
              .then((reactionData) => {
                fetchedReactions[review._id] = reactionData[review._id] || {};
              })
              .catch((error) =>
                console.error(`Error fetching reactions for ${review._id}:`, error)
              )
          )
        );

        setReactionCounts(fetchedReactions);
        setLoading(false);
      })
      .catch((error) => {
        console.error("Error fetching reviews:", error);
        toast.error(`Erreur lors de la récupération des avis: ${error.message}`);
        setLoading(false);
      });
  }, [isOpen, doctorId]);

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    const token = localStorage.getItem("token");

    if (!token) {
      toast.error("Veuillez vous connecter pour soumettre un avis.");
      return;
    }

    if (newReview.rating < 1 || newReview.rating > 5) {
      toast.error("La note doit être entre 1 et 5.");
      return;
    }

    if (!newReview.comment.trim()) {
      toast.error("Un commentaire est requis.");
      return;
    }

    try {
      console.log("Submitting review for doctorId:", doctorId, "with data:", newReview);
      const response = await fetch(
        `http://localhost:3000/api/reviews/doctor/${doctorId}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            rating: newReview.rating,
            comment: newReview.comment,
          }),
        }
      );

      console.log("Response status:", response.status);
      if (!response.ok) {
        const errorText = await response.text();
        console.error("Response text:", errorText);
        throw new Error(`Failed to submit review: ${errorText}`);
      }

      const addedReview = await response.json();
      console.log("Added review:", addedReview);
      setReviews((prevReviews) => [addedReview, ...prevReviews]);
      setNewReview({ rating: 0, comment: "" });
      toast.success("Avis soumis avec succès !");
    } catch (error) {
      console.error("Error submitting review:", error);
      toast.error(`Erreur lors de la soumission de l'avis: ${error.message}`);
    }
  };

  const fetchReactions = async (reviewId: string) => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(
        `http://localhost:3000/api/reactions/review/${reviewId}`,
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );
      if (!response.ok) throw new Error("Failed to fetch reactions");

      const data = await response.json();
      setReactionCounts((prev) => ({
        ...prev,
        [reviewId]: data[reviewId] || {},
      }));
    } catch (error) {
      console.error("Error fetching reactions:", error);
    }
  };

  const handleReaction = async (reviewId: string, reaction: string) => {
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    const userId = user?.id || user?.data?.id;
    const token = localStorage.getItem("token");

    if (!userId || !token) {
      toast.error("Veuillez vous connecter pour réagir.");
      return;
    }

    try {
      const currentReactionResponse = await fetch(
        `http://localhost:3000/api/reactions/user-reaction?userId=${userId}&reviewId=${reviewId}`,
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );
      if (!currentReactionResponse.ok) throw new Error("Failed to fetch current reaction");
      const currentReactionData = await currentReactionResponse.json();
      const currentReaction = currentReactionData.reaction;

      let requestMethod = "POST";
      let requestUrl = "http://localhost:3000/api/reactions/react";
      let bodyData = { userId, reviewId, type: reaction };

      if (currentReaction === reaction) {
        requestMethod = "POST"; // Toggle off
      } else if (currentReaction) {
        requestMethod = "PUT";
        requestUrl = "http://localhost:3000/api/reactions/update-reaction";
        bodyData = { userId, reviewId, newType: reaction };
      }

      const response = await fetch(requestUrl, {
        method: requestMethod,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(bodyData),
      });

      if (!response.ok) throw new Error("Failed to update reaction");

      await fetchReactions(reviewId);
      toast.success("Réaction mise à jour !");
    } catch (error) {
      console.error("Error handling reaction:", error);
      toast.error("Erreur lors de la mise à jour de la réaction.");
    }
  };

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-gray-500 dark:bg-gray-900 bg-opacity-75 flex justify-center items-center"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.8 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="fixed inset-0 bg-gray-500 dark:bg-gray-900 bg-opacity-75 flex justify-center items-center"
      >
        <div className="fixed inset-0 bg-black dark:bg-gray-900 bg-opacity-50 flex justify-center items-center z-50">
          <div className="bg-white dark:bg-black rounded-xl shadow-lg p-6 w-96 relative">
            <button
              onClick={onClose}
              className="absolute top-2 right-2 text-gray-500 hover:text-gray-700"
            >
              <X className="w-6 h-6" />
            </button>

            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <MessageCircle className="w-6 h-6 text-indigo-600" />
              Avis des patients
            </h2>

            <div className="space-y-4 max-h-[300px] overflow-y-scroll scrollbar-hide">
              {loading ? (
                <div className="space-y-4">
                  {[...Array(3)].map((_, index) => (
                    <div key={index} className="animate-pulse space-y-2">
                      <div className="h-4 bg-gray-300 rounded w-3/4"></div>
                      <div className="h-6 bg-gray-300 rounded w-full"></div>
                    </div>
                  ))}
                </div>
              ) : Array.isArray(reviews) && reviews.length > 0 ? (
                reviews.map((review) => (
                  <div key={review._id} className="border-b pb-4 last:border-0">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="flex">
                          {[...Array(5)].map((_, i) => (
                            <Star
                              key={i}
                              className={`w-4 h-4 ${
                                i < review.rating
                                  ? "text-yellow-400 fill-current"
                                  : "text-gray-300"
                              }`}
                            />
                          ))}
                        </div>
                        <span className="font-medium">
                          {review.patientName}
                        </span>
                      </div>
                      <span className="text-sm text-gray-500">
                        {format(new Date(review.date), "PP", { locale: fr })}
                      </span>
                    </div>

                    <p className="text-gray-600">{review.comment}</p>

                    <div className="flex gap-4 mt-3">
                      {["like", "heart", "dislike"].map((reaction) => {
                        const count = reactionCounts[review._id]?.[reaction] || 0;
                        return (
                          <motion.div
                            key={reaction}
                            className="flex items-center gap-1 cursor-pointer"
                            whileHover={{ scale: 1.2 }}
                            onClick={() => handleReaction(review._id, reaction)}
                          >
                            {reaction === "like" && (
                              <ThumbsUp className="w-6 h-6 text-gray-500" />
                            )}
                            {reaction === "heart" && (
                              <Heart className="w-6 h-6 text-red-500" />
                            )}
                            {reaction === "dislike" && (
                              <ThumbsDown className="w-6 h-6 text-yellow-500" />
                            )}
                            <span className="text-gray-700 font-medium">
                              {count}
                            </span>
                          </motion.div>
                        );
                      })}
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-gray-500">Aucun avis pour ce médecin.</p>
              )}
            </div>

            <form onSubmit={handleSubmitReview} className="mt-4">
              <div className="flex items-center gap-2">
                {[...Array(5)].map((_, i) => (
                  <Star
                    key={i}
                    className={`w-6 h-6 ${
                      i < newReview.rating
                        ? "text-yellow-400 fill-current"
                        : "text-gray-300"
                    }`}
                    onClick={() =>
                      setNewReview({ ...newReview, rating: i + 1 })
                    }
                  />
                ))}
              </div>
              <textarea
                className="mt-2 w-full p-2 border dark:bg-gray-900 border-gray-300 rounded-md"
                placeholder="Votre avis"
                value={newReview.comment}
                onChange={(e) =>
                  setNewReview({ ...newReview, comment: e.target.value })
                }
              />
              <button
                type="submit"
                className="mt-3 w-full bg-indigo-600 text-white py-2 rounded-md hover:bg-indigo-700"
              >
                Ajouter un avis
              </button>
            </form>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}