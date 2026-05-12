export default function Privacy() {
  return (
    <main className="min-h-screen bg-gray-50 py-16 px-4">
      <div className="max-w-3xl mx-auto">

        <div className="mb-12">
          <a href="/" className="text-sm text-blue-600 hover:underline">Back to ResearchOS</a>
          <h1 className="text-3xl font-semibold text-gray-900 mt-6 mb-2">Privacy Policy</h1>
          <p className="text-gray-500 text-sm">Last updated: May 2026</p>
        </div>

        <div className="space-y-10">

          <section>
            <h2 className="text-lg font-semibold text-gray-800 mb-3">What ResearchOS does</h2>
            <p className="text-gray-600 text-sm leading-relaxed">
              ResearchOS is an AI-powered research synthesis tool. You upload research papers, and the system produces a structured synthesis with verified citations. Your data is used solely to provide this service.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-800 mb-3">What data we collect</h2>
            <div className="space-y-3">
              {[
                ["Email address", "Used for account creation and login. Never shared with third parties."],
                ["Uploaded PDFs", "Processed in memory to extract text. PDF files are not stored on our servers after processing."],
                ["Synthesis results", "Stored in our database linked to your account so you can retrieve past sessions."],
                ["Usage metadata", "Date and time of syntheses. Used to improve the product."],
              ].map(([item, desc]) => (
                <div key={item} className="flex gap-4 p-4 bg-white rounded-xl border border-gray-100">
                  <div className="min-w-40 text-sm font-medium text-gray-700">{item}</div>
                  <div className="text-sm text-gray-500">{desc}</div>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-800 mb-3">Where data is stored</h2>
            <p className="text-gray-600 text-sm leading-relaxed">
              Account data and synthesis results are stored in Supabase — a secure PostgreSQL database hosted on AWS. Each user can only access their own data. Row-level security policies are enforced at the database level.
            </p>
            <p className="text-gray-600 text-sm leading-relaxed mt-3">
              AI processing is handled by Anthropic's Claude API. Text extracted from your papers is sent to Anthropic's servers for synthesis. Anthropic's data handling policy applies to this processing. Anthropic does not use API inputs to train their models by default.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-800 mb-3">What we do not do</h2>
            <div className="space-y-2">
              {[
                "We do not sell your data to any third party",
                "We do not use your research papers to train AI models",
                "We do not store uploaded PDF files after processing",
                "We do not share your synthesis results with other users",
                "We do not send marketing emails without your consent",
              ].map(item => (
                <div key={item} className="flex items-start gap-3 text-sm text-gray-600">
                  <span className="text-green-500 mt-0.5 font-bold">x</span>
                  {item}
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-800 mb-3">Your rights</h2>
            <p className="text-gray-600 text-sm leading-relaxed">
              You can delete your account and all associated data at any time by contacting us. You can export your synthesis history at any time using the export features in the app. You have the right to request a copy of all data we hold about you.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-800 mb-3">Cookies</h2>
            <p className="text-gray-600 text-sm leading-relaxed">
              ResearchOS uses only essential cookies required for authentication. We do not use tracking cookies or third-party advertising cookies.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-800 mb-3">Contact</h2>
            <p className="text-gray-600 text-sm leading-relaxed">
              For any privacy-related questions or data deletion requests, contact us at:
            </p>
            <p className="text-sm text-blue-600 mt-2">bandaruchetan16@gmail.com</p>
          </section>

        </div>

        <div className="mt-16 pt-8 border-t border-gray-200">
          <p className="text-xs text-gray-400 text-center">ResearchOS — Built by Chetan Kumar Bandaru, India</p>
        </div>

      </div>
    </main>
  )
}