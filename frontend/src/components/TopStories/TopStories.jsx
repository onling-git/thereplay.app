import React from "react";

import newsStoryPlaceholder from "../../assets/images/news-story-placeholder.png";

import "./topstories.css";

const TopStories = () => {
  return (
    <div>
      <div>
        <h2>Live Scores</h2>
      </div>
      <div className="top-stories-card-container">
        <div
          className="top-stories-card"
          style={{
            backgroundImage: `url(${newsStoryPlaceholder})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
            width: "100%",
          }}
        >
          <div className="top-stories-card-footer">
            <h3>HEADLINE THAT'S EXCITING!</h3>
          </div>

        </div>
      </div>
    </div>
  );
};

export default TopStories;
