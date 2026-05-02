import Modal from '@/Components/Modal';
import SecondaryButton from '@/Components/SecondaryButton';

export default function AttachmentPreviewModal({ show, onClose, url, label = 'Attachment Preview' }) {
    const isImage = url?.match(/\.(jpeg|jpg|gif|png|webp|svg)$/i) || url?.includes('image');

    return (
        <Modal show={show} onClose={onClose} maxWidth="4xl">
            <div className="flex flex-col h-full max-h-[90vh]">
                {/* Header */}
                <div className="p-4 flex justify-between items-center border-b border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-t-2xl">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-900/30">
                            <svg className="h-5 w-5 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                            </svg>
                        </div>
                        <h2 className="text-lg font-bold text-gray-900 dark:text-white truncate max-w-[250px] sm:max-w-md">
                            {label}
                        </h2>
                    </div>
                    <button 
                        onClick={onClose} 
                        className="p-2 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:text-gray-300 dark:hover:bg-gray-700 transition-colors"
                    >
                        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 p-4 relative bg-gray-50 dark:bg-gray-900 overflow-auto min-h-[50vh] flex items-center justify-center">
                    {url ? (
                        isImage ? (
                            <img 
                                src={url} 
                                alt={label} 
                                className="max-w-full max-h-[70vh] rounded-lg object-contain shadow-2xl ring-1 ring-black/5" 
                            />
                        ) : (
                            <iframe 
                                src={url} 
                                className="w-full h-[70vh] rounded-lg bg-white shadow-2xl border-0" 
                                title={label} 
                            />
                        )
                    ) : (
                        <div className="flex flex-col items-center justify-center text-gray-400 py-20">
                            <svg className="h-12 w-12 mb-4 opacity-20" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6.75a1.5 1.5 0 0 0-1.5-1.5H3.75a1.5 1.5 0 0 0-1.5 1.5v12.75a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
                            </svg>
                            <p className="text-sm font-medium">No preview available</p>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-gray-100 dark:border-gray-700 flex justify-end gap-3 bg-white dark:bg-gray-800 rounded-b-2xl">
                    <SecondaryButton onClick={onClose}>
                        Close
                    </SecondaryButton>
                    {url && (
                        <a 
                            href={url} 
                            download 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-blue-900/20 hover:scale-105 transition-all active:scale-95"
                        >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M7.5 12 12 16.5m0 0L16.5 12M12 16.5V3" />
                            </svg>
                            Download File
                        </a>
                    )}
                </div>
            </div>
        </Modal>
    );
}
