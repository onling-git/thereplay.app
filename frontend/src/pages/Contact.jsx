// src/pages/Contact.jsx
import React, { useState } from 'react';
import Header from '../components/Header/Header';
import FooterNav from '../components/FooterNav/FooterNav';
import './css/contact.css';

const Contact = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: ''
  });
  
  const [submitStatus, setSubmitStatus] = useState(null);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    // TODO: Implement actual form submission logic
    console.log('Form submitted:', formData);
    setSubmitStatus('success');
    
    // Reset form after successful submission
    setTimeout(() => {
      setFormData({
        name: '',
        email: '',
        subject: '',
        message: ''
      });
      setSubmitStatus(null);
    }, 3000);
  };

  return (
    <div>
      <Header />
      <div className="contact-page">
        <div className="contact-container">
          <div className="contact-header">
            <h1>Get in Touch</h1>
            <p>Have a question, suggestion, or feedback? We'd love to hear from you.</p>
          </div>

          <div className="contact-content">
            <div className="contact-form-section">
              <h2>Send us a Message</h2>
              <form onSubmit={handleSubmit} className="contact-form">
                <div className="form-group">
                  <label htmlFor="name">Name *</label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    required
                    placeholder="Your full name"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="email">Email *</label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    required
                    placeholder="your.email@example.com"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="subject">Subject *</label>
                  <select
                    id="subject"
                    name="subject"
                    value={formData.subject}
                    onChange={handleChange}
                    required
                  >
                    <option value="">Select a subject</option>
                    <option value="general">General Inquiry</option>
                    <option value="technical">Technical Support</option>
                    <option value="subscription">Subscription Issues</option>
                    <option value="feedback">Feedback & Suggestions</option>
                    <option value="partnership">Partnership Opportunities</option>
                    <option value="press">Press & Media</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="message">Message *</label>
                  <textarea
                    id="message"
                    name="message"
                    value={formData.message}
                    onChange={handleChange}
                    required
                    rows="6"
                    placeholder="Tell us how we can help..."
                  />
                </div>

                {submitStatus === 'success' && (
                  <div className="submit-success">
                    Thank you! Your message has been sent successfully. We'll get back to you soon.
                  </div>
                )}

                {submitStatus === 'error' && (
                  <div className="submit-error">
                    Sorry, there was an error sending your message. Please try again.
                  </div>
                )}

                <button type="submit" className="submit-button">
                  Send Message
                </button>
              </form>
            </div>

            <div className="contact-info-section">
              <h2>Contact Information</h2>
              
              <div className="info-card">
                <div className="info-icon">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                    <polyline points="22,6 12,13 2,6"/>
                  </svg>
                </div>
                <div className="info-content">
                  <h3>Email</h3>
                  <a href="mailto:contact@thefinalplay.com">contact@thefinalplay.com</a>
                  <p className="info-description">For general inquiries</p>
                </div>
              </div>

              <div className="info-card">
                <div className="info-icon">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                    <polyline points="22,6 12,13 2,6"/>
                  </svg>
                </div>
                <div className="info-content">
                  <h3>Support</h3>
                  <a href="mailto:support@thefinalplay.com">support@thefinalplay.com</a>
                  <p className="info-description">For technical issues</p>
                </div>
              </div>

              <div className="info-card">
                <div className="info-icon">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
                    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
                    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>
                  </svg>
                </div>
                <div className="info-content">
                  <h3>Social Media</h3>
                  <p>Follow us for updates</p>
                  <div className="social-links">
                    <a href="#" aria-label="Twitter">Twitter</a>
                    <a href="#" aria-label="Facebook">Facebook</a>
                    <a href="#" aria-label="Instagram">Instagram</a>
                  </div>
                </div>
              </div>

              <div className="faq-link">
                <h3>Looking for answers?</h3>
                <p>Check out our FAQ section or browse our help documentation for quick solutions to common questions.</p>
              </div>

              <div className="response-time">
                <h3>Response Time</h3>
                <p>We typically respond to inquiries within 24-48 hours during business days. For urgent matters, please mention "URGENT" in your subject line.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
      <FooterNav />
    </div>
  );
};

export default Contact;
