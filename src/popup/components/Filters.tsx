import React from 'react';

interface Props {
  courses: string[];
  courseDisplayNames: Map<string, string>;
  selectedCourse: string;
  onCourseChange: (course: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

function Filters({ courses, courseDisplayNames, selectedCourse, onCourseChange, searchQuery, onSearchChange }: Props) {
  return (
    <div className="filters">
      <div className="filter-group">
        <label htmlFor="course-filter">Course:</label>
        <select
          id="course-filter"
          value={selectedCourse}
          onChange={(e) => onCourseChange(e.target.value)}
          className="course-select"
        >
          <option value="all">All Courses</option>
          {courses.map(course => (
            <option key={course} value={course}>
              {courseDisplayNames.get(course) || course}
            </option>
          ))}
        </select>
      </div>

      <div className="filter-group">
        <label htmlFor="search-input">Search:</label>
        <input
          id="search-input"
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search deadlines..."
          className="search-input"
        />
      </div>
    </div>
  );
}

export default Filters;
