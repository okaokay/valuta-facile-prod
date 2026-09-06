import React, { useState } from 'react';

function FileUpload({ onPlanimetryAnalysis }) {
  const [file, setFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      // Verifica che il file sia un PDF
      if (selectedFile.type !== 'application/pdf') {
        setUploadError('Per favore carica un file PDF');
        setFile(null);
        return;
      }
      
      // Verifica che il file non superi i 10MB
      if (selectedFile.size > 10 * 1024 * 1024) {
        setUploadError('Il file non deve superare i 10MB');
        setFile(null);
        return;
      }
      
      setFile(selectedFile);
      setUploadError(null);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setUploadError('Seleziona un file da caricare');
      return;
    }

    setIsUploading(true);
    setUploadError(null);
    setUploadSuccess(false);

    try {
      // Simuliamo l'analisi della planimetria
      // In un'implementazione reale, qui invieremmo il file a un'API
      // che utilizza un modello LLM per analizzare la planimetria
      
      // Simulazione di una chiamata API con un ritardo
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Risultato simulato dell'analisi
      const analysisResult = {
        // Fattore di aggiustamento basato sull'analisi della planimetria
        adjustmentFactor: Math.random() * 0.2 + 0.9, // Valore tra 0.9 e 1.1
        // Dettagli dell'analisi
        details: {
          layout: 'Ottimizzato', // o 'Standard', 'Non ottimale'
          lightExposure: 'Buona', // o 'Media', 'Scarsa'
          roomDistribution: 'Efficiente', // o 'Standard', 'Inefficiente'
          accessibilityScore: Math.floor(Math.random() * 3) + 3, // Valore da 3 a 5
        }
      };
      
      // Chiamiamo la callback con il risultato dell'analisi
      onPlanimetryAnalysis(analysisResult);
      
      setUploadSuccess(true);
    } catch (error) {
      console.error('Errore durante l\'analisi della planimetria:', error);
      setUploadError('Si è verificato un errore durante l\'analisi della planimetria');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-center w-full">
        <label htmlFor="planimetry-upload" className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100">
          <div className="flex flex-col items-center justify-center pt-5 pb-6">
            <svg className="w-8 h-8 mb-3 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path>
            </svg>
            <p className="mb-2 text-sm text-gray-500">
              <span className="font-semibold">Clicca per caricare</span> o trascina qui la planimetria
            </p>
            <p className="text-xs text-gray-500">PDF (MAX. 10MB)</p>
          </div>
          <input 
            id="planimetry-upload" 
            type="file" 
            className="hidden" 
            accept="application/pdf" 
            onChange={handleFileChange} 
          />
        </label>
      </div>
      
      {file && (
        <div className="flex items-center space-x-2">
          <svg className="w-5 h-5 text-gray-500" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
            <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd"></path>
          </svg>
          <span className="text-sm text-gray-700 truncate">{file.name}</span>
          <button 
            type="button" 
            onClick={() => setFile(null)} 
            className="text-red-500 hover:text-red-700"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"></path>
            </svg>
          </button>
        </div>
      )}
      
      <div className="flex justify-center">
        <button
          type="button"
          onClick={handleUpload}
          disabled={!file || isUploading}
          className={`px-4 py-2 text-sm font-medium text-white rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${!file || isUploading ? 'bg-blue-300 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
        >
          {isUploading ? (
            <>
              <svg className="inline w-4 h-4 mr-2 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Analisi in corso...
            </>
          ) : 'Analizza planimetria'}
        </button>
      </div>
      
      {uploadError && (
        <div className="text-sm text-red-600 text-center">
          {uploadError}
        </div>
      )}
      
      {uploadSuccess && (
        <div className="text-sm text-green-600 text-center">
          Planimetria analizzata con successo!
        </div>
      )}
    </div>
  );
}

export default FileUpload;