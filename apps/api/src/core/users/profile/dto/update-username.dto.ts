import { ApiProperty } from '@nestjs/swagger';
import { IsDefined, IsString, Length, Matches } from 'class-validator';
import { Transform } from 'class-transformer';
import { USERNAME_MIN, USERNAME_MAX, USERNAME_REGEX } from '../username.rules';

export class UpdateUsernameDto {
  @ApiProperty({
    example: 'amirhossein_var',
    description:
      `۳ تا ${USERNAME_MAX} کاراکتر، فقط حروف انگلیسی/عدد/زیرخط، ` +
      'بدون فاصله (به‌صورت خودکار lowercase می‌شود)',
    minLength: USERNAME_MIN,
    maxLength: USERNAME_MAX,
  })
  @IsDefined({ message: 'نام کاربری الزامی است.' })
  @IsString({ message: 'نام کاربری باید رشته باشد.' })
  @Length(USERNAME_MIN, USERNAME_MAX, {
    message: `نام کاربری باید بین ${USERNAME_MIN} تا ${USERNAME_MAX} کاراکتر باشد.`,
  })
  @Matches(USERNAME_REGEX, {
    message:
      'فقط حروف انگلیسی، عدد، زیرخط؛ نه با زیرخط شروع/تمام شود؛ زیرخط‌های متوالی مجاز نیست.',
  })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  username!: string;
}
