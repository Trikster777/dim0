import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../ui/alert-dialog"
import { useTranslation } from "react-i18next"


/**
 * Properties for the ConfirmDeleteBoardAlert component.
 *
 * @property {boolean} open - Indicates whether the alert dialog is open.
 * @property {(open: boolean) => void} onOpenChange - Callback function to handle changes in the open state.
 * @property {() => void} onConfirm - Callback function to handle the confirmation action.
 * @property {string} [title] - Optional title for the alert dialog.
 * @property {string} [description] - Optional description for the alert dialog.
 */
type ConfirmDeleteBoardAlertProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  title?: string
  description?: string
}


/**
 * ConfirmDeleteBoardAlert component displays a confirmation dialog for deleting a board.
 *
 * @param {ConfirmDeleteBoardAlertProps} props - The properties for the component.
 * @returns {JSX.Element} The rendered ConfirmDeleteBoardAlert component.
 */
export function ConfirmDeleteBoardAlert({
  open,
  onOpenChange,
  onConfirm,
  title,
  description,
}: ConfirmDeleteBoardAlertProps) {
  const { t } = useTranslation()
  const dialogTitle = title ?? t('sidebar.confirm_delete.title')
  const dialogDescription = description ?? t('sidebar.confirm_delete.description')
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{dialogTitle}</AlertDialogTitle>
          <AlertDialogDescription>
            {dialogDescription}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel>
            {t('common.cancel')}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-destructive !text-destructive-foreground hover:bg-destructive/90"
          >
            {t('common.delete')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}