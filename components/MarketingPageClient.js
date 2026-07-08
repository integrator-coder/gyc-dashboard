export default function MarketingPage() {
  const sections = [
    {
      title: 'Lead Generation',
      icon: '🎯',
      metrics: [
        'Leads from Form Fill', 'Booked Calls from Form', '% Booked Calls to Leads'
      ]
    },
    {
      title: 'Ad Spend',
      icon: '💸',
      metrics: ['Media Spend', 'Ad Cost Per Lead', 'Ad Cost Per Booked Call']
    },
    {
      title: 'Lead Quality',
      icon: '🔍',
      metrics: [
        'No Shows', 'SQL (Capacity 100+)', 'QL (Capacity 24–99)', 'SQL to Lead %',
        'Nonqualified (12–23)', 'Nonqualified (0–11)', 'Unknown Capacity', 'Qualified; Not Booked'
      ]
    },
    {
      title: 'Sales by Package',
      icon: '📦',
      metrics: [
        'Web+Blueprint+SEO+CRM', 'Blueprint+SEO', 'Blueprint', 'Command', 'Master',
        'GYC Site+Blueprint', 'GYC Site+CRM', 'GYC Site', 'Core Site', 'Big Site',
        'SEO', 'CRM', 'CRM Mini Boost', 'Enrollment Accelerator', 'Core Accelerator',
        'Big Accelerator', 'S3', 'VT', 'Google Ads', 'Paid Ads II', 'Paid Ads III'
      ]
    },
    {
      title: 'Revenue Performance',
      icon: '📈',
      metrics: [
        'Total Sales', 'Rolling 4-Week Avg Sales',
        'Total Revenue', 'Rolling 4-Week Avg Revenue', 'Rolling 4-Week Avg ROAS',
        'Total PIF Value', 'Rolling 4-Week Avg PIF', 'Rolling 4-Week Avg PIF ROAS',
        'Total MRR Value', 'Rolling 4-Week Avg MRR', 'Rolling 4-Week Avg MRR ROAS'
      ]
    }
  ]

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Marketing</h1>
          <p className="text-gray-300 text-sm mt-0.5">Google Ads · Meta Ads · Campaign Performance</p>
        </div>
        <span className="px-3 py-1 bg-yellow-900/40 border border-yellow-700 text-yellow-400 text-xs font-medium rounded-full">
          APIs connecting tomorrow
        </span>
      </div>

      <div className="bg-gray-900 rounded-xl border border-gray-800 px-6 py-4 text-sm text-gray-400">
        Waiting on Google Ads + Meta Ads API access. All sections below are scoped and ready to build.
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {sections.map(section => (
          <div key={section.title} className="bg-gray-900 rounded-xl border border-gray-800 p-5 opacity-60">
            <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
              <span>{section.icon}</span>
              {section.title}
            </h3>
            <div className="flex flex-wrap gap-2">
              {section.metrics.map(m => (
                <span key={m} className="text-xs bg-gray-800 text-gray-300 px-2 py-1 rounded-md border border-gray-700">
                  {m}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
