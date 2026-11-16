import React, { useState } from 'react';
import { apiFetch } from '../../../lib/api/client';

export const ContactForm: React.FC = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [subject, setSubject] = useState('Bespoke Appointment');
  const [preferredContact, setPreferredContact] = useState<'email' | 'phone' | 'whatsapp'>('email');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMsg(null);
    setErrorMsg(null);

    if (name.trim().length < 2) {
      setErrorMsg('Please enter your full name.');
      return;
    }
    if (!email.trim().includes('@')) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }
    if (message.trim().length < 10) {
      setErrorMsg('Please share a brief inquiry message (at least 10 characters).');
      return;
    }

    let cleanPhone: string | undefined;
    if (phone.trim()) {
      let digits = phone.replace(/\D/g, '');
      if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
      if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
      if (!/^[6-9]\d{9}$/.test(digits)) {
        setErrorMsg('Mobile number must be a valid 10-digit Indian mobile number.');
        return;
      }
      cleanPhone = digits;
    }

    setIsSubmitting(true);
    try {
      const res = await apiFetch<{ inquiryId?: string; message?: string }>('/api/contact', {
        method: 'POST',
        skipAuthRefresh: true,
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          phone: cleanPhone,
          subject,
          message: message.trim(),
          preferredContact,
        }),
      });

      if (res.success) {
        setStatusMsg(
          res.data?.message ||
            'Your request has been registered with our Client Concierge. We will respond within one business day.',
        );
        setName('');
        setEmail('');
        setPhone('');
        setMessage('');
      } else {
        setErrorMsg(res.error?.message || 'Unable to submit request at this time. Please retry shortly.');
      }
    } catch {
      setErrorMsg('Network error submitting concierge inquiry.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6" noValidate>
      {errorMsg && (
        <div role="alert" className="p-3.5 bg-red-50 border border-red-200 text-red-700 text-xs">
          {errorMsg}
        </div>
      )}
      {statusMsg && (
        <div role="status" className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs">
          {statusMsg}
        </div>
      )}

      <div>
        <label htmlFor="contact-name" className="block text-[11px] uppercase tracking-wider font-mono text-neutral-700 mb-2">
          Full Name
        </label>
        <input
          id="contact-name"
          type="text"
          required
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your full name"
          className="w-full h-11 px-4 bg-[#faf8f5] border border-neutral-300 text-xs focus:outline-none focus:border-neutral-900"
        />
      </div>

      <div>
        <label htmlFor="contact-email" className="block text-[11px] uppercase tracking-wider font-mono text-neutral-700 mb-2">
          Email Address
        </label>
        <input
          id="contact-email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="client@example.com"
          className="w-full h-11 px-4 bg-[#faf8f5] border border-neutral-300 text-xs focus:outline-none focus:border-neutral-900"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="contact-phone" className="block text-[11px] uppercase tracking-wider font-mono text-neutral-700 mb-2">
            Phone (Optional)
          </label>
          <input
            id="contact-phone"
            type="tel"
            autoComplete="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="10-digit mobile"
            className="w-full h-11 px-4 bg-[#faf8f5] border border-neutral-300 text-xs focus:outline-none focus:border-neutral-900"
          />
        </div>
        <div>
          <label htmlFor="contact-preferred" className="block text-[11px] uppercase tracking-wider font-mono text-neutral-700 mb-2">
            Preferred Channel
          </label>
          <select
            id="contact-preferred"
            value={preferredContact}
            onChange={(e) => setPreferredContact(e.target.value as 'email' | 'phone' | 'whatsapp')}
            className="w-full h-11 px-4 bg-[#faf8f5] border border-neutral-300 text-xs focus:outline-none focus:border-neutral-900"
          >
            <option value="email">Email</option>
            <option value="phone">Phone Call</option>
            <option value="whatsapp">WhatsApp Concierge</option>
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="contact-subject" className="block text-[11px] uppercase tracking-wider font-mono text-neutral-700 mb-2">
          Inquiry Subject
        </label>
        <select
          id="contact-subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className="w-full h-11 px-4 bg-[#faf8f5] border border-neutral-300 text-xs focus:outline-none focus:border-neutral-900"
        >
          <option value="Bespoke Appointment">Bespoke Fitting &amp; Consultation</option>
          <option value="Order & Logistics">Order &amp; Logistics Support</option>
          <option value="Garment Inquiry">Garment Composition &amp; Sizing</option>
          <option value="Press & Archive">Press &amp; Archive Relations</option>
        </select>
      </div>

      <div>
        <label htmlFor="contact-message" className="block text-[11px] uppercase tracking-wider font-mono text-neutral-700 mb-2">
          Message
        </label>
        <textarea
          id="contact-message"
          rows={4}
          required
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="How may our atelier assist you?"
          className="w-full p-4 bg-[#faf8f5] border border-neutral-300 text-xs focus:outline-none focus:border-neutral-900 resize-none"
        />
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full h-12 rounded-full bg-neutral-900 hover:bg-black text-white text-xs uppercase tracking-widest font-medium transition-all shadow-sm disabled:opacity-50"
      >
        {isSubmitting ? 'Sending Inquiry...' : 'Send Concierge Inquiry'}
      </button>
    </form>
  );
};

export default ContactForm;
