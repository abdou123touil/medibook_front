import React, { useEffect, useState } from "react";
import { Star, MessageCircle, X } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface Review {
  id: string;
  patientName: string;
  rating: number;
  comment: string;
  date: string;
  helpful: number;
}

interface ReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  doctorId: string;
}

export function ReviewModal({ isOpen, onClose, doctorId }: ReviewModalProps) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [newReview, setNewReview] = useState({ rating: 0, comment: "" });

  useEffect(() => {
    if (isOpen) {
      fetch(`http://localhost:3000/api/appointments/doctor/${doctorId}/reviews`)
        .then((response) => response.json())
        .then((data) => {
          if (Array.isArray(data)) {
            setReviews(data);
          } else {
            console.error("Unexpected API response:", data);
            setReviews([]); // Ensure it's always an array
          }
        })
        .catch((error) => {
          console.error("Error fetching reviews:", error);
          setReviews([]); // Set to an empty array on error
        });
    }
  }, [isOpen, doctorId]);

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    const fname = user?.data?.firstName;
    const lname = user?.data?.lastName;
    const fullname = fname+' '+ lname;
    try {
      const response = await fetch(
        `http://localhost:3000/api/appointments/doctor/${doctorId}/review`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            patientName: fullname, // Ensure patientName is sent
            rating: newReview.rating,
            comment: newReview.comment,
            helpful: 0, // Add the missing "helpful" field
          }),
        }
      );

      if (!response.ok) {
        const errorMessage = await response.text();
        throw new Error(`Failed to submit review: ${errorMessage}`);
      }

      // Fetch updated reviews
      const updatedReviews = await fetch(
        `http://localhost:3000/api/appointments/doctor/${doctorId}/reviews`
      ).then((res) => res.json());

      setReviews(updatedReviews);
      setNewReview({ rating: 0, comment: "" });
    } catch (error) {
      console.error("Error submitting review:", error);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
      <div className="bg-white rounded-xl shadow-lg p-6 w-96 relative">
        {/* Close Button */}
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

        <div className="space-y-4">
          {Array.isArray(reviews) && reviews.length > 0 ? (
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
                    <span className="font-medium">{review.patientName}</span>
                  </div>
                  <span className="text-sm text-gray-500">
                    {format(new Date(review.date), "PP", { locale: fr })}
                  </span>
                </div>
                <p className="text-gray-600">{review.comment}</p>
              </div>
            ))
          ) : (
            <p className="text-gray-500">Aucun avis pour ce médecin.</p>
          )}
        </div>

        {/* Review Form */}
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
                onClick={() => setNewReview({ ...newReview, rating: i + 1 })}
              />
            ))}
          </div>
          <textarea
            className="mt-2 w-full p-2 border border-gray-300 rounded-md"
            placeholder="Votre avis"
            value={newReview.comment}
            onChange={(e) =>
              setNewReview({ ...newReview, comment: e.target.value })
            }
          />
          <button
            type="submit"
            className="mt-4 px-6 py-2 bg-indigo-600 text-white rounded-md w-full"
          >
            Soumettre l'avis
          </button>
        </form>
      </div>
    </div>
  );
}
