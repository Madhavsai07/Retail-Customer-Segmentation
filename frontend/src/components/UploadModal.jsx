import { FiLayers, FiX, FiAlertTriangle, FiActivity } from 'react-icons/fi';

export default function UploadModal({
  isOpen,
  onClose,
  uploading,
  uploadError,
  pipelineProgress,
  onFileUpload,
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg flex flex-col max-h-[90vh] animate-slide-up overflow-hidden border border-gray-100">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/50">
          <div>
            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <FiLayers className="text-primary-500" />
              Upload Transaction Data
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">CSV or Excel format with customer purchase records</p>
          </div>
          {!uploading && (
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors p-1 hover:bg-gray-100 rounded-lg"
            >
              <FiX size={20} />
            </button>
          )}
        </div>

        <div className="p-6 overflow-y-auto space-y-6">
          {!uploading ? (
            <>
              <label className="border-2 border-dashed border-gray-200 hover:border-primary-400 bg-gray-50/50 hover:bg-primary-50/10 rounded-2xl p-8 flex flex-col items-center justify-center cursor-pointer transition-all group">
                <input
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  className="hidden"
                  onChange={(e) => onFileUpload(e.target.files[0])}
                />
                <div className="w-12 h-12 bg-white rounded-xl shadow-sm border border-gray-100 flex items-center justify-center text-gray-400 group-hover:text-primary-500 transition-colors mb-4">
                  <FiLayers size={22} />
                </div>
                <p className="text-sm font-semibold text-gray-700">Click to upload or drag & drop</p>
                <p className="text-xs text-gray-400 mt-1 text-center">
                  Supports .csv, .xlsx, .xls files.<br />
                  Must contain columns: <span className="font-semibold text-gray-600">CustomerID, InvoiceDate, Quantity, UnitPrice</span>
                </p>
              </label>

              <div className="text-center text-xs text-gray-500 bg-gray-50/80 border border-gray-100 rounded-xl py-2.5 px-4 flex items-center justify-between">
                <span>Don't have a dataset to test?</span>
                <a
                  href="/retail_small_dataset.csv"
                  download="retail_small_dataset.csv"
                  className="text-primary-600 hover:text-primary-700 font-semibold hover:underline flex items-center gap-1"
                >
                  Download Sample CSV (3MB)
                </a>
              </div>

              {uploadError && (
                <div className="bg-red-50 border border-red-100 text-red-700 text-xs px-4 py-3 rounded-xl flex items-start gap-2.5">
                  <FiAlertTriangle className="text-red-500 shrink-0 mt-0.5" size={14} />
                  <div>
                    <p className="font-semibold">Upload Failed</p>
                    <p className="mt-0.5 text-red-600 leading-relaxed">{uploadError}</p>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="space-y-6">
              <div className="text-center space-y-3">
                <div className="relative w-16 h-16 mx-auto flex items-center justify-center">
                  <div className="absolute inset-0 border-4 border-primary-100 border-t-primary-600 rounded-full animate-spin" />
                  <FiActivity className="text-primary-600 animate-pulse" size={24} />
                </div>
                <div>
                  <h4 className="font-bold text-gray-900 text-base">{pipelineProgress?.step || 'Running ML Pipeline...'}</h4>
                  <p className="text-xs text-gray-400 mt-0.5">Please keep this window open while we run the analysis</p>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-semibold text-gray-500">
                  <span>Overall Progress</span>
                  <span>{pipelineProgress?.progress || 0}%</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-primary-500 to-accent-400 transition-all duration-500 rounded-full"
                    style={{ width: `${pipelineProgress?.progress || 0}%` }}
                  />
                </div>
              </div>

              <div className="border border-gray-100 rounded-xl p-4 bg-gray-50/30 space-y-3 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Pipeline Stages</span>
                </div>
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between text-gray-600">
                    <span className="flex items-center gap-2">
                      {pipelineProgress?.progress > 20 ? '✅' : '⏳'} 1. Clean Data
                    </span>
                    {pipelineProgress?.cleaning_summary && (
                      <span className="text-xs font-medium text-gray-400">
                        {pipelineProgress.cleaning_summary.final_rows?.toLocaleString()} rows
                      </span>
                    )}
                  </div>
                  <div className="flex items-center text-gray-600 gap-2">
                    {pipelineProgress?.progress > 40 ? '✅' : '⏳'} 2. Compute RFM Features
                  </div>
                  <div className="flex items-center text-gray-600 gap-2">
                    {pipelineProgress?.progress > 60 ? '✅' : '⏳'} 3. Find Optimal Clusters
                  </div>
                  <div className="flex items-center text-gray-600 gap-2">
                    {pipelineProgress?.progress > 80 ? '✅' : '⏳'} 4. Train K-Means Model
                  </div>
                  <div className="flex items-center text-gray-600 gap-2">
                    {pipelineProgress?.progress >= 100 ? '✅' : '⏳'} 5. Generate Personas
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

