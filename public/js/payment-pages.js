// JavaScript for payment success and cancel pages
document.addEventListener('DOMContentLoaded', function() {
  // Handle feedback form submission
  const feedbackForm = document.getElementById('feedbackForm');
  if (feedbackForm) {
    feedbackForm.addEventListener('submit', function(e) {
      e.preventDefault();
      
      const reason = document.getElementById('cancelReason').value;
      const feedback = document.getElementById('feedbackText').value;
      
      // In production, send this data to your server
      console.log('Feedback submitted:', { reason, feedback });
      
      // Show success message
      feedbackForm.innerHTML = '<p class="feedback-success">Thank you for your feedback!</p>';
    });
  }
  
  // Dynamically update WhatsApp links with the correct phone number
  const updateWhatsAppLinks = () => {
    const phoneNumber = '+2348012345678'; // Replace with your actual WhatsApp number
    const whatsAppLinks = document.querySelectorAll('a[href^="whatsapp://send"]');
    
    whatsAppLinks.forEach(link => {
      const href = link.getAttribute('href');
      const updatedHref = href.replace('YOUR_PHONE_NUMBER', phoneNumber);
      link.setAttribute('href', updatedHref);
    });
  };
  
  updateWhatsAppLinks();
});