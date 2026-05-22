import React, { useState, useEffect } from 'react';
import { KYCDocument } from '@/types/kyc';
import { isFieldInRegion } from '@/lib/aadhaarRegions';
import { BadgeCheck, ShieldAlert, ShieldX, FileSearch, Crosshair, UserCheck } from 'lucide-react';

interface SplitScreenWorkflowProps {
  document: KYCDocument | null;
  status: string;
}

export const SplitScreenWorkflow: React.FC<SplitScreenWorkflowProps> = ({ document, status }) => {
  const [hoveredField, setHoveredField] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'data' | 'security'>('data');
  const [revealedFields, setRevealedFields] = useState<Record<string, boolean>>({});

  // Simulate OCR text typing reveal when loading/processing starts
  useEffect(() => {
    if (status === 'processing') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRevealedFields({});
    } else if (status === 'success' || status === 'warning' || status === 'failed') {
      if (document) {
        // Reveal fields one by one
        const timer = setTimeout(() => {
          const newRevealed: Record<string, boolean> = {};
          document.extractedFields.forEach((field) => {
            newRevealed[field.key] = true;
          });
          setRevealedFields(newRevealed);
        }, 100);
        return () => clearTimeout(timer);
      }
    }
  }, [status, document]);

  if (!document) {
    return (
      <div className="glass-panel rounded-xl p-8 flex flex-col items-center justify-center min-h-[450px] text-center border-dashed border-violet-900/40">
        <FileSearch className="w-12 h-12 text-violet-600/50 mb-4" />
        <h3 className="text-lg font-semibold text-slate-300">No Document Loaded</h3>
        <p className="text-xs text-slate-500 max-w-sm mt-2 leading-relaxed">
          Please drag & drop your verification document, upload a file, or select one of our interactive scenario presets above to see the split-screen workflow.
        </p>
      </div>
    );
  }

  // Helper to render safety badges
  const renderSafetyBadge = (type: string) => {
    switch (type) {
      case 'PASSED':
        return (
          <span className="flex items-center text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full font-semibold">
            <BadgeCheck className="w-3.5 h-3.5 mr-1" />
            PASSED
          </span>
        );
      case 'SUSPECTED TAMPERING':
        return (
          <span className="flex items-center text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-full font-semibold animate-pulse">
            <ShieldAlert className="w-3.5 h-3.5 mr-1 animate-bounce" />
            SUSPECTED TAMPERING
          </span>
        );
      case 'FAILED':
        return (
          <span className="flex items-center text-[10px] bg-rose-500/10 text-rose-400 border border-rose-500/20 px-2 py-0.5 rounded-full font-semibold">
            <ShieldX className="w-3.5 h-3.5 mr-1" />
            FAILED
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="glass-panel rounded-xl overflow-hidden flex flex-col lg:flex-row border border-violet-900/40 w-full mb-6">
      
      {/* LEFT PANEL: Document Image / Layout Canvas */}
      <div className="flex-1 p-6 border-b lg:border-b-0 lg:border-r border-violet-900/40 bg-violet-950/30/20 relative flex flex-col items-center justify-center">
        
        {/* Panel Header */}
        <div className="w-full flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-violet-500 animate-ping" />
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">Document Scan — Auto-Detected Regions</span>
          </div>
          <span className="text-[10px] text-slate-500 font-mono">ID: {document.id}</span>
        </div>

        {/* Document Frame — image-sized wrapper so region boxes align with the scan */}
        <div className="flex justify-center items-center w-full min-h-[360px] max-h-[560px] bg-violet-950/30 rounded-lg border border-violet-900/40/80 shadow-2xl group overflow-hidden p-2">
          {document.previewUrl ? (
            <div
              className="relative mx-auto w-full"
              style={{
                aspectRatio:
                  document.imageWidth && document.imageHeight
                    ? `${document.imageWidth} / ${document.imageHeight}`
                    : undefined,
                maxHeight: '540px',
                maxWidth: '100%',
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={document.previewUrl}
                alt="Uploaded document"
                className="absolute inset-0 w-full h-full object-contain rounded-sm"
              />
              {status === 'processing' && (
                <div className="absolute inset-0 pointer-events-none z-30 rounded-sm overflow-hidden">
                  <div className="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-violet-400 to-transparent shadow-[0_0_15px_rgba(139,92,246,0.8)] animate-scan" />
                  <div className="absolute inset-0 bg-violet-500/5" />
                </div>
              )}
              {status !== 'processing' &&
                document.boundingBoxes.map((box) => {
                  const isHovered = hoveredField === box.fieldKey;
                  const isFullDoc = box.fieldKey === 'full_document';
                  return (
                    <div
                      key={box.fieldKey}
                      onMouseEnter={() => setHoveredField(box.fieldKey)}
                      onMouseLeave={() => setHoveredField(null)}
                      style={{
                        left: `${box.x}%`,
                        top: `${box.y}%`,
                        width: `${box.width}%`,
                        height: `${box.height}%`,
                      }}
                      className={`absolute z-20 rounded-lg cursor-pointer transition-all duration-200
                        ${isFullDoc
                          ? 'border border-dashed border-violet-500/25 bg-violet-500/[0.03] pointer-events-none'
                          : ''}
                        ${!isFullDoc && isHovered
                          ? 'border-2 border-violet-400 bg-violet-500/25 shadow-[0_0_16px_rgba(139,92,246,0.5)]'
                          : ''}
                        ${!isFullDoc && !isHovered
                          ? 'border-2 border-violet-400/50 bg-violet-500/10 hover:border-violet-400 hover:bg-violet-500/20'
                          : ''}
                      `}
                    >
                      {!isFullDoc && (
                        <span
                          className={`absolute left-1 top-1 px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wide
                            ${isHovered ? 'bg-violet-500 text-white' : 'bg-violet-950/30/80 text-violet-300 border border-violet-500/30'}
                          `}
                        >
                          {box.label}
                        </span>
                      )}
                    </div>
                  );
                })}
            </div>
          ) : (
            <div
              className={`relative w-full max-w-[420px] aspect-[1.58/1] bg-slate-900`}
            >
              {status === 'processing' && (
                <div className="absolute inset-0 pointer-events-none z-30">
                  <div className="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-violet-400 to-transparent shadow-[0_0_15px_rgba(139,92,246,0.8)] animate-scan" />
                  <div className="absolute inset-0 bg-violet-500/5 backdrop-blur-[0.5px]" />
                </div>
              )}

              {/* Render Vector SVGs representing specific documents */}
              {document.type === 'passport' && (
            <svg className="absolute inset-0 w-full h-full text-slate-300" viewBox="0 0 632 400" fill="none">
              <rect width="632" height="400" fill="#141c2f"/>
              {/* Cover texture / Stamp outline */}
              <circle cx="500" cy="180" r="80" stroke="#1f2d4d" strokeWidth="2" strokeDasharray="5 5" fill="none" />
              <text x="470" y="185" fill="#1f2d4d" fontSize="11" fontWeight="bold">CUSTOMS IMMIGRATION</text>
              {/* Photo Box */}
              <rect x="30" y="80" width="160" height="220" rx="6" fill="#1b2438" stroke="#253556"/>
              {/* Avatar placeholder */}
              <circle cx="110" cy="160" r="45" fill="#253556"/>
              <path d="M65,240 C65,200 155,200 155,240 L155,270 L65,270 Z" fill="#253556"/>
              <circle cx="110" cy="155" r="2" fill="#fff" opacity="0.3"/>
              {/* Text Blocks */}
              <text x="230" y="70" fill="#475b83" fontSize="12" fontWeight="bold">UNITED STATES OF AMERICA</text>
              <text x="230" y="100" fill="#324467" fontSize="10">Surname / Nom</text>
              <text x="230" y="118" fill="#e2e8f0" fontSize="13" fontWeight="bold">HARRINGTON</text>
              <text x="230" y="150" fill="#324467" fontSize="10">Given Names / Prénoms</text>
              <text x="230" y="168" fill="#e2e8f0" fontSize="13" fontWeight="bold">SARAH ELIZABETH</text>
              <text x="230" y="200" fill="#324467" fontSize="10">Nationality / Nationalité</text>
              <text x="230" y="218" fill="#e2e8f0" fontSize="12" fontWeight="bold">UNITED STATES OF AMERICA</text>
              <text x="230" y="250" fill="#324467" fontSize="10">Date of birth / Date de naissance</text>
              <text x="230" y="268" fill="#e2e8f0" fontSize="12" fontWeight="bold">14 OCT 1992</text>
              <text x="440" y="250" fill="#324467" fontSize="10">Date of expiry / Date d&apos;expiration</text>
              <text x="440" y="268" fill="#e2e8f0" fontSize="12" fontWeight="bold">18 FEB 2032</text>
              {/* MRZ Zone */}
              <rect x="30" y="325" width="572" height="50" rx="4" fill="#0c111e"/>
              <text x="40" y="344" fill="#3b82f6" fontSize="11" fontFamily="monospace">P&lt;USAHARRINGTON&lt;&lt;SARAH&lt;ELIZABETH&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;</text>
              <text x="40" y="362" fill="#3b82f6" fontSize="11" fontFamily="monospace">P984210984USA9210145F3202187&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;06</text>
            </svg>
          )}

              {document.type === 'license' && (
            <svg className="absolute inset-0 w-full h-full text-slate-300" viewBox="0 0 632 400" fill="none">
              <rect width="632" height="400" fill="#131e35"/>
              {/* State Header */}
              <rect x="0" y="0" width="632" height="60" fill="#1e2e4e"/>
              <text x="316" y="38" textAnchor="middle" fill="#f8fafc" fontSize="20" fontWeight="bold" letterSpacing="4">CALIFORNIA</text>
              {/* California watermark outlines */}
              <path d="M450,220 C420,180 500,100 580,240 L550,290 Z" stroke="#25375c" strokeWidth="2" fill="none" opacity="0.3" />
              {/* Photo Box */}
              <rect x="35" y="90" width="160" height="210" rx="4" fill="#1e293b" stroke="#334155" />
              {/* Avatar placeholder */}
              <circle cx="115" cy="170" r="42" fill="#334155"/>
              <path d="M75,245 C75,210 155,210 155,245 L155,280 L75,280 Z" fill="#334155"/>
              {/* Text Fields */}
              <text x="230" y="105" fill="#f43f5e" fontSize="15" fontWeight="bold">DL88210344</text>
              <text x="230" y="130" fill="#475d86" fontSize="9">FN / Full Name</text>
              <text x="230" y="148" fill="#e2e8f0" fontSize="14" fontWeight="bold">MARCUS AURELIUS</text>
              <text x="230" y="180" fill="#475d86" fontSize="9">ADDRESS</text>
              <text x="230" y="196" fill="#e2e8f0" fontSize="11" fontWeight="bold">452 VISTA GRANDE</text>
              <text x="230" y="210" fill="#e2e8f0" fontSize="11" fontWeight="bold">LOS ALTOS, CA 94024</text>
              <text x="230" y="245" fill="#475d86" fontSize="9">DOB / Date of Birth</text>
              <text x="230" y="262" fill="#f59e0b" fontSize="12" fontWeight="bold">26 APR 1980</text>
              <text x="410" y="245" fill="#475d86" fontSize="9">EXP / Expiry Date</text>
              <text x="410" y="262" fill="#e2e8f0" fontSize="12" fontWeight="bold">26 APR 2028</text>
              {/* Signature */}
              <text x="35" y="340" fill="#64748b" fontSize="9" fontStyle="italic">Signature / Signature</text>
              <path d="M35,370 Q60,350 90,370 T150,360" fill="none" stroke="#e2e8f0" strokeWidth="2" />
            </svg>
          )}

              {document.type === 'utility_bill' && (
            <svg className="absolute inset-0 w-full h-full" viewBox="0 0 632 400" fill="none">
              <rect width="632" height="400" fill="#0f172a"/>
              {/* Invoice Layout */}
              <rect x="30" y="25" width="130" height="30" fill="#1e293b" rx="4"/>
              <text x="42" y="44" fill="#38bdf8" fontSize="11" fontWeight="bold">CON EDISON</text>
              <text x="500" y="42" fill="#475569" fontSize="9">STATEMENT DATE</text>
              <text x="500" y="58" fill="#e2e8f0" fontSize="12" fontWeight="bold">12 JAN 2025</text>
              <line x1="30" y1="80" x2="602" y2="80" stroke="#334155" strokeWidth="1"/>
              {/* Customer Box */}
              <text x="35" y="115" fill="#475569" fontSize="9">CUSTOMER</text>
              <text x="35" y="132" fill="#e2e8f0" fontSize="13" fontWeight="bold">ROBERT JOHNSON</text>
              <text x="35" y="160" fill="#475569" fontSize="9">SERVICE ADDRESS</text>
              <text x="35" y="178" fill="#e2e8f0" fontSize="12" fontWeight="bold">789 E 10TH ST APT 4B</text>
              <text x="35" y="194" fill="#e2e8f0" fontSize="12" fontWeight="bold">NEW YORK, NY 10009</text>
              {/* Account details */}
              <rect x="420" y="110" width="180" height="150" fill="#1b243b" rx="6" stroke="#253556"/>
              <text x="435" y="135" fill="#38bdf8" fontSize="9">ACCOUNT NUMBER</text>
              <text x="435" y="152" fill="#e2e8f0" fontSize="12" fontWeight="bold">99-8877-6655-1</text>
              <text x="435" y="195" fill="#38bdf8" fontSize="9">TOTAL AMOUNT DUE</text>
              <text x="435" y="215" fill="#f43f5e" fontSize="18" fontWeight="bold">$184.20</text>
              {/* Billing table graphic */}
              <rect x="35" y="280" width="560" height="90" fill="#1b253b" rx="4" opacity="0.3"/>
              <line x1="35" y1="310" x2="595" y2="310" stroke="#334155" strokeWidth="0.5"/>
              <rect x="50" y="292" width="120" height="8" rx="2" fill="#334155"/>
              <rect x="50" y="325" width="220" height="8" rx="2" fill="#334155" opacity="0.5"/>
              <rect x="50" y="345" width="180" height="8" rx="2" fill="#334155" opacity="0.5"/>
              {/* Barcode */}
              <rect x="440" y="340" width="140" height="20" fill="#64748b" opacity="0.1"/>
              <line x1="450" y1="340" x2="450" y2="360" stroke="#64748b" strokeWidth="2" />
              <line x1="455" y1="340" x2="455" y2="360" stroke="#64748b" strokeWidth="1" />
              <line x1="460" y1="340" x2="460" y2="360" stroke="#64748b" strokeWidth="3" />
              <line x1="468" y1="340" x2="468" y2="360" stroke="#64748b" strokeWidth="1" />
              <line x1="475" y1="340" x2="475" y2="360" stroke="#64748b" strokeWidth="4" />
            </svg>
          )}

              {/* Interactive Bounding Box Overlays (SVG mock documents only) */}
              {status !== 'processing' && document.boundingBoxes.map((box) => {
            const isHovered = hoveredField === box.fieldKey;
            return (
              <div
                key={box.fieldKey}
                onMouseEnter={() => setHoveredField(box.fieldKey)}
                onMouseLeave={() => setHoveredField(null)}
                style={{
                  left: `${box.x}%`,
                  top: `${box.y}%`,
                  width: `${box.width}%`,
                  height: `${box.height}%`,
                }}
                className={`absolute z-20 rounded-md border-2 cursor-pointer transition-all duration-200 flex items-center justify-center
                  ${isHovered 
                    ? 'border-violet-400 bg-violet-500/20 shadow-[0_0_12px_rgba(139,92,246,0.6)] scale-[1.02]' 
                    : 'border-violet-500/30 bg-violet-500/5 hover:border-violet-400 hover:bg-violet-500/10'}
                `}
              >
                {/* Tooltip on bounding box hover */}
                {isHovered && (
                  <div className="absolute bottom-full mb-1.5 px-2 py-1 bg-violet-950/30 text-slate-200 border border-violet-500/30 rounded text-[9px] font-bold whitespace-nowrap shadow-xl z-50 pointer-events-none">
                    {box.label}
                  </div>
                )}
              </div>
            );
              })}
            </div>
          )}
        </div>

        {/* Hover Highlight Tip */}
        <div className="w-full text-center mt-4">
          <p className="text-[10px] text-slate-400 flex items-center justify-center">
            <Crosshair className="w-3.5 h-3.5 mr-1 text-violet-400" />
            Hover over boxes on the document to trace their extracted data field counterpart.
          </p>
        </div>
      </div>

      {/* RIGHT PANEL: Extraction Fields & Safety Indicators */}
      <div className="flex-1 p-6 flex flex-col h-full justify-between">
        
        {/* Toggle tabs for data vs security indicators */}
        <div className="flex border-b border-violet-900/40 pb-3 mb-4 justify-between items-center">
          <div className="flex space-x-4">
            <button
              onClick={() => setActiveTab('data')}
              className={`text-xs font-bold uppercase tracking-wider pb-1.5 relative transition-colors duration-200
                ${activeTab === 'data' ? 'text-white' : 'text-slate-500 hover:text-slate-300'}
              `}
            >
              Extracted Data
              {activeTab === 'data' && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-violet-500 shadow-[0_0_8px_rgba(139,92,246,0.8)]" />}
            </button>
            <button
              onClick={() => setActiveTab('security')}
              className={`text-xs font-bold uppercase tracking-wider pb-1.5 relative transition-colors duration-200
                ${activeTab === 'security' ? 'text-white' : 'text-slate-500 hover:text-slate-300'}
              `}
            >
              Safety Audit
              {activeTab === 'security' && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-violet-500 shadow-[0_0_8px_rgba(139,92,246,0.8)]" />}
            </button>
          </div>

          <div className="flex items-center space-x-1.5">
            <span className="text-[10px] text-slate-400 uppercase font-semibold">Status:</span>
            {status === 'processing' ? (
              <span className="flex items-center text-[10px] bg-violet-500/10 text-violet-400 border border-violet-500/20 px-2.5 py-0.5 rounded font-bold uppercase animate-pulse">
                Analyzing
              </span>
            ) : status === 'success' ? (
              <span className="flex items-center text-[10px] bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 px-2.5 py-0.5 rounded font-bold uppercase">
                Passed
              </span>
            ) : status === 'warning' ? (
              <span className="flex items-center text-[10px] bg-amber-500/15 text-amber-400 border border-amber-500/30 px-2.5 py-0.5 rounded font-bold uppercase animate-pulse">
                Suspected
              </span>
            ) : (
              <span className="flex items-center text-[10px] bg-rose-500/15 text-rose-400 border border-rose-500/30 px-2.5 py-0.5 rounded font-bold uppercase">
                Failed
              </span>
            )}
          </div>
        </div>

        {/* Tab 1: Extracted OCR Fields */}
        {activeTab === 'data' && (
          <div className="flex-1 flex flex-col justify-between min-h-[300px]">
            {status === 'processing' ? (
              <div className="flex-1 flex flex-col items-center justify-center py-12">
                <FileSearch className="w-10 h-10 text-violet-400 animate-pulse mb-4" />
                <span className="text-xs text-slate-400">Performing optical character recognition...</span>
              </div>
            ) : (
              <div className="space-y-3">
                {document.extractedFields.map((field) => {
                  const isHovered =
                    document.type === 'aadhaar' ||
                    document.type === 'passport' ||
                    document.type === 'pan' ||
                    document.type === 'license'
                      ? isFieldInRegion(field.key, hoveredField)
                      : hoveredField === field.key;
                  const isRevealed = revealedFields[field.key] || false;

                  return (
                    <div
                      key={field.key}
                      onMouseEnter={() => setHoveredField(field.key)}
                      onMouseLeave={() => setHoveredField(null)}
                      className={`p-3 rounded-lg border transition-all duration-200 relative overflow-hidden
                        ${isHovered 
                          ? 'bg-violet-950/20 border-violet-500/50 shadow-[0_0_12px_rgba(139,92,246,0.08)]' 
                          : 'bg-slate-900/20 border-violet-900/40/80 hover:border-slate-700'}
                        ${!isRevealed ? 'opacity-20 translate-y-1' : 'opacity-100 translate-y-0'}
                      `}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider block">
                            {field.label}
                          </span>
                          <span className="text-sm font-bold text-white mt-1 block">
                            {field.value}
                          </span>
                        </div>
                        <div className="flex flex-col items-end">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold
                            ${field.confidence >= 95 ? 'text-emerald-400 bg-emerald-500/5 border border-emerald-500/10' : ''}
                            ${field.confidence >= 75 && field.confidence < 95 ? 'text-amber-400 bg-amber-500/5 border border-amber-500/10' : ''}
                            ${field.confidence < 75 ? 'text-rose-400 bg-rose-500/5 border border-rose-500/10' : ''}
                          `}>
                            {field.confidence.toFixed(1)}% OCR
                          </span>
                          {field.isMatch !== undefined && (
                            <span className={`text-[9px] font-semibold mt-1.5 flex items-center
                              ${field.isMatch ? 'text-emerald-400' : 'text-rose-400'}
                            `}>
                              {field.isMatch ? (
                                <>
                                  <BadgeCheck className="w-3 h-3 mr-0.5" /> Checked & Match
                                </>
                              ) : (
                                <>
                                  <ShieldX className="w-3 h-3 mr-0.5" /> Verification Fail
                                </>
                              )}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Safety Audit & Forgery Indicators */}
        {activeTab === 'security' && (
          <div className="flex-1 flex flex-col justify-between min-h-[300px]">
            {status === 'processing' ? (
              <div className="flex-1 flex flex-col items-center justify-center py-12">
                <ShieldAlert className="w-10 h-10 text-violet-400 animate-pulse mb-4" />
                <span className="text-xs text-slate-400">Analyzing security features, check signatures...</span>
              </div>
            ) : (
              <div className="space-y-4">
                
                {/* Face Biometrics Widget */}
                {document.type !== 'utility_bill' && (
                  <div className="p-4 rounded-xl bg-slate-900/30 border border-violet-900/40 flex items-center justify-between">
                    <div className="flex items-center space-x-3.5">
                      <div className="relative">
                        <div className="w-11 h-11 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center overflow-hidden">
                          {document.type === 'passport' ? (
                            <svg className="w-9 h-9 text-slate-400" fill="currentColor" viewBox="0 0 24 24">
                              <circle cx="12" cy="8" r="4" /><path d="M12 14c-6.1 0-8 4-8 4v2h16v-2s-1.9-4-8-4z" />
                            </svg>
                          ) : (
                            <svg className="w-9 h-9 text-slate-400" fill="currentColor" viewBox="0 0 24 24">
                              <circle cx="12" cy="8" r="4" /><path d="M12 14c-6.1 0-8 4-8 4v2h16v-2s-1.9-4-8-4z" />
                            </svg>
                          )}
                        </div>
                        <div className="absolute -bottom-1 -right-1 p-1 bg-emerald-500 rounded-full text-slate-950">
                          <UserCheck className="w-3 h-3" />
                        </div>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Applicant Face Match</span>
                        <span className="text-xs text-slate-500 block mt-0.5">Checked with Live Selfie</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-lg font-bold text-white block">
                        {document.type === 'passport' ? '98.4%' : '91.2%'}
                      </span>
                      <span className="text-[9px] text-emerald-400 font-bold block">MATCH CONFIRMED</span>
                    </div>
                  </div>
                )}

                {/* Grid list of indicators */}
                <div className="space-y-3">
                  {document.safetyIndicators.map((indicator) => (
                    <div key={indicator.id} className="p-3 rounded-lg bg-slate-900/20 border border-violet-900/40/80">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs font-bold text-slate-200">
                          {indicator.name}
                        </span>
                        {renderSafetyBadge(indicator.status)}
                      </div>
                      <p className="text-[11px] text-slate-400 leading-normal">
                        {indicator.details}
                      </p>
                      {indicator.score !== undefined && (
                        <div className="mt-2.5">
                          <div className="flex justify-between text-[9px] text-slate-500 mb-1">
                            <span>Analysis Confidence</span>
                            <span>{indicator.score}%</span>
                          </div>
                          <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                indicator.status === 'PASSED' ? 'bg-emerald-500' :
                                indicator.status === 'SUSPECTED TAMPERING' ? 'bg-amber-500' : 'bg-rose-500'
                              }`}
                              style={{ width: `${indicator.score}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

    </div>
  );
};
