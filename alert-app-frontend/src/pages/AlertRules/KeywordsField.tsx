import { KEYWORDS_MAX } from '@alert-app/shared';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { Autocomplete, IconButton, TextField, Tooltip } from '@mui/material';
import { useState, type KeyboardEvent } from 'react';
import { useController } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { fieldErrorText } from '../../global/utils/fieldError';
import type { KeywordsFieldProps } from '../../types/alert-rules/alertRules';
import styles from './AlertRulesPage.module.scss';

/**
 * Keywords as chips: type a word or phrase and press Enter. Text that was typed but not
 * added yet is added when leaving the field, so it isn't lost. The info button explains it.
 */
export function KeywordsField({ control }: KeywordsFieldProps) {
  const { t } = useTranslation('alerts');
  const {
    field: { ref, value, onChange, onBlur },
    fieldState: { error },
  } = useController({ control, name: 'keywords' });
  const [inputValue, setInputValue] = useState('');
  // The keyword that was not added because it's already in the list
  const [duplicate, setDuplicate] = useState<string | null>(null);

  const setKeywords = (keywords: string[]) =>
    onChange(keywords.map((keyword) => keyword.trim()).filter(Boolean));

  // Ignoring case, like the server's duplicate rule
  const isDuplicate = (text: string) =>
    value.some((keyword) => keyword.toLowerCase() === text.trim().toLowerCase());

  const addTypedKeyword = () => {
    const keyword = inputValue.trim();
    if (keyword && isDuplicate(keyword)) setDuplicate(keyword);
    else if (keyword) setKeywords([...value, keyword]);
    setInputValue('');
  };

  const duplicateText = duplicate && t('dialog.keywordDuplicate', { keyword: duplicate });

  return (
    <div className={styles.keywords}>
      <Autocomplete
        className={styles.keywordsInput}
        multiple
        freeSolo
        options={[]}
        value={value}
        onChange={(_event, keywords) => setKeywords(keywords)}
        inputValue={inputValue}
        onInputChange={(_event, text, reason) => {
          setInputValue(text);
          if (reason === 'input') setDuplicate(null);
        }}
        onKeyDown={(event: KeyboardEvent<HTMLDivElement> & { defaultMuiPrevented?: boolean }) => {
          // MUI would silently ignore an existing keyword: say so instead.
          // The typed text stays, so it can be corrected.
          if (event.key === 'Enter' && inputValue.trim() && isDuplicate(inputValue)) {
            event.defaultMuiPrevented = true;
            event.preventDefault(); // and don't submit the form
            setDuplicate(inputValue.trim());
          }
        }}
        onBlur={() => {
          addTypedKeyword();
          onBlur();
        }}
        renderInput={(params) => (
          <TextField
            {...params}
            inputRef={ref}
            label={t('dialog.keywords')}
            placeholder={value.length === 0 ? t('dialog.keywordsPlaceholder') : undefined}
            required
            error={Boolean(error)}
            helperText={
              fieldErrorText(error) ??
              duplicateText ??
              t('dialog.keywordsHint', { max: KEYWORDS_MAX })
            }
            // Screen readers read the text out when it changes (e.g. the duplicate message)
            slotProps={{ ...params.slotProps, formHelperText: { 'aria-live': 'polite' } }}
          />
        )}
      />
      {/* describeChild: the text is the button's description, its name stays short.
          enterTouchDelay 0: a tap shows it on touch screens (default is a long press). */}
      <Tooltip
        title={t('dialog.keywordsHelpText')}
        describeChild
        enterTouchDelay={0}
        leaveTouchDelay={8000}
      >
        <IconButton aria-label={t('dialog.keywordsHelp')} className={styles.keywordsHelp}>
          <InfoOutlinedIcon />
        </IconButton>
      </Tooltip>
    </div>
  );
}
