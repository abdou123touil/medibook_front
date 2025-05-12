import React from "react";
import ContentLoader from "react-content-loader";

const DoctorSkeleton = () => {
  return (
    <div className="bg-white dark:bg-gray-900 border rounded-lg p-6 shadow-md">
      <ContentLoader
        speed={2}
        width="100%"
        height={120}
        viewBox="0 0 400 120"
        backgroundColor="#f3f3f3"
        foregroundColor="#ecebeb"
      >
        {/* Nom du médecin */}
        <rect x="10" y="10" rx="4" ry="4" width="60%" height="15" />
        
        {/* Spécialité */}
        <rect x="10" y="35" rx="4" ry="4" width="40%" height="12" />
        
        {/* Description */}
        <rect x="10" y="60" rx="4" ry="4" width="90%" height="10" />
        <rect x="10" y="75" rx="4" ry="4" width="85%" height="10" />
        
        {/* Boutons */}
        <rect x="10" y="100" rx="6" ry="6" width="40%" height="30" />
        <rect x="55%" y="100" rx="6" ry="6" width="40%" height="30" />
      </ContentLoader>
    </div>
  );
};

export default DoctorSkeleton;
