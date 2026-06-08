import Button from './Button';

type LargeButtonProps = {
  children: string;
  onClick?: () => void;
  disabled?: boolean;
}

const LargeButton = ({ children, onClick, disabled }: LargeButtonProps) => {
  return (
    <Button
      variant="ghostLavender"
      radius="lg"
      className='min-w-10'
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </Button>
  )
}

export default LargeButton;
