import { useRef, useState } from 'react';
import InputLabel from './InputLabel';
import InputError from './InputError';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

export default function MultiFileUploader({
    label = 'Supporting Documents',
    description = 'Upload supporting files (5MB per file)',
    value = [],
    onChange,
    onError,
    error = null,
    disabled = false,
    className = '',
}) {
    const fileInputRef = useRef(null);
    const [dragActive, setDragActive] = useState(false);
    const [localFiles, setLocalFiles] = useState(value || []);
    const [validationError, setValidationError] = useState(error);

    const formatFileSize = (bytes) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const calculateTotalSize = (files) => {
        return files.reduce((total, file) => total + (file.size || 0), 0);
    };

    const handlePreview = (file) => {
        if (!(file instanceof File)) return;
        
        try {
            const url = URL.createObjectURL(file);
            const win = window.open(url, '_blank');
            if (win) {
                win.focus();
            } else {
                alert('Please allow popups to preview files.');
            }
            // We don't revoke immediately because the new tab needs it.
            // Browsers usually clean up blob URLs when the origin page is closed.
        } catch (e) {
            console.error('Preview failed:', e);
        }
    };

    const validateFiles = (filesToAdd) => {
        setValidationError(null);

        // Check if any file is not an object (already processed file)
        const newFiles = filesToAdd.filter((file) => file instanceof File);

        // Check each file
        for (const file of newFiles) {
            // Check file type
            if (!ALLOWED_TYPES.includes(file.type)) {
                const msg = `File type not allowed: ${file.name}`;
                setValidationError(msg);
                if (onError) onError(msg);
                return false;
            }

            // Check individual file size
            if (file.size > MAX_FILE_SIZE) {
                const msg = `File too large: ${file.name} (${formatFileSize(file.size)})`;
                setValidationError(msg);
                if (onError) onError(msg);
                return false;
            }
        }

        return true;
    };

    const handleFileSelect = (e) => {
        const files = Array.from(e.target.files || []);
        if (validateFiles(files)) {
            const updatedFiles = [...localFiles, ...files];
            setLocalFiles(updatedFiles);
            if (onChange) onChange(updatedFiles);
        }
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleDrag = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!disabled) {
            setDragActive(e.type === 'dragenter' || e.type === 'dragover');
        }
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!disabled) {
            setDragActive(false);
            const files = Array.from(e.dataTransfer.files || []);
            const validFiles = files.filter((file) => ALLOWED_TYPES.includes(file.type));

            if (validFiles.length !== files.length) {
                const msg = 'Some files were not supported. Only images, PDF, and Word documents are allowed.';
                setValidationError(msg);
                if (onError) onError(msg);
            }

            if (validFiles.length > 0 && validateFiles(validFiles)) {
                const updatedFiles = [...localFiles, ...validFiles];
                setLocalFiles(updatedFiles);
                if (onChange) onChange(updatedFiles);
            }
        }
    };

    const removeFile = (index) => {
        const updatedFiles = localFiles.filter((_, i) => i !== index);
        setLocalFiles(updatedFiles);
        setValidationError(null);
        if (onChange) onChange(updatedFiles);
    };

    return (
        <div className={className}>
            {label && <InputLabel value={label} />}

            <div
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                className={`relative mt-2 rounded-xl border-2 border-dashed transition-colors ${
                    disabled
                        ? 'border-gray-300 bg-gray-50 dark:border-gray-700 dark:bg-gray-900/50'
                        : dragActive
                        ? 'border-[#7a1315] bg-red-50 dark:border-red-500 dark:bg-red-900/10'
                        : 'border-gray-300 bg-white hover:border-gray-400 dark:border-gray-700 dark:bg-gray-900 dark:hover:border-gray-600'
                }`}
            >
                <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept={ALLOWED_TYPES.join(',')}
                    onChange={handleFileSelect}
                    disabled={disabled}
                    className="hidden"
                    aria-label="File upload"
                />

                <button
                    type="button"
                    onClick={() => !disabled && fileInputRef.current?.click()}
                    disabled={disabled}
                    className="block w-full px-6 py-8 text-center"
                >
                    <div className="flex flex-col items-center justify-center gap-2">
                        <svg
                            className={`h-8 w-8 ${disabled ? 'text-gray-400' : 'text-[#7a1315] dark:text-red-400'}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M12 4v16m8-8H4"
                            />
                        </svg>
                        <div className="flex gap-1 text-sm">
                            <span className={`font-semibold ${disabled ? 'text-gray-600 dark:text-gray-500' : 'text-[#7a1315] dark:text-red-400'}`}>
                                Click to upload
                            </span>
                            <span className="text-gray-600 dark:text-gray-400">or drag and drop</span>
                        </div>
                        <p className="text-xs text-gray-600 dark:text-gray-400">{description}</p>
                    </div>
                </button>
            </div>

            {/* File list */}
            {localFiles.length > 0 && (
                <div className="mt-4 space-y-2">
                    <div className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                        Files ({localFiles.length})
                    </div>

                    {/* File items */}
                    <ul className="space-y-2">
                        {localFiles.map((file, index) => (
                            <li
                                key={`${file.name}-${index}`}
                                className="group flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                            >
                                <button
                                    type="button"
                                    onClick={() => handlePreview(file)}
                                    className="flex flex-1 items-center gap-3 min-w-0 text-left"
                                    title="Click to preview"
                                    disabled={disabled}
                                >
                                    {file.type.startsWith('image/') ? (
                                        <svg
                                            className="h-5 w-5 flex-shrink-0 text-blue-500"
                                            fill="none"
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                        >
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth={2}
                                                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                                            />
                                        </svg>
                                    ) : file.type === 'application/pdf' ? (
                                        <svg
                                            className="h-5 w-5 flex-shrink-0 text-red-500"
                                            fill="currentColor"
                                            viewBox="0 0 24 24"
                                        >
                                            <path d="M8 16.5a1 1 0 11-2 0 1 1 0 012 0zM15 16.5a1 1 0 11-2 0 1 1 0 012 0zM10.5 5h3c.825 0 1.5.675 1.5 1.5v3H9v-3c0-.825.675-1.5 1.5-1.5z" />
                                        </svg>
                                    ) : (
                                        <svg
                                            className="h-5 w-5 flex-shrink-0 text-amber-500"
                                            fill="currentColor"
                                            viewBox="0 0 24 24"
                                        >
                                            <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v2h8v-2z" />
                                        </svg>
                                    )}
                                    <div className="min-w-0">
                                        <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                            {file.name}
                                        </p>
                                        <p className="text-xs text-gray-600 dark:text-gray-400">
                                            {formatFileSize(file.size)}
                                        </p>
                                    </div>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => removeFile(index)}
                                    disabled={disabled}
                                    className="ml-2 flex-shrink-0 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 disabled:opacity-50"
                                    aria-label={`Remove ${file.name}`}
                                >
                                    <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                                        <path
                                            fillRule="evenodd"
                                            d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                                            clipRule="evenodd"
                                        />
                                    </svg>
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {/* Error message */}
            {validationError && <InputError message={validationError} className="mt-2" />}
        </div>
    );
}
