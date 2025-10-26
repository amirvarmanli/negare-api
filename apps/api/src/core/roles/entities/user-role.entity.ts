/**
 * UserRole entity represents the many-to-many join between users and roles.
 */
import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  Unique,
} from 'typeorm';
import { BaseEntity } from '@app/shared/base.entity';
import { Role } from '@app/core/roles/entities/role.entity';
import { User } from '@app/core/users/user.entity';

@Entity({ name: 'user_roles' })
@Unique(['userId', 'roleId'])
/**
 * Join entity storing associations while enforcing uniqueness per user/role pair.
 */
export class UserRole extends BaseEntity {
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'role_id', type: 'uuid' })
  roleId: string;

  @ManyToOne(() => User, (user) => user.userRoles, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => Role, (role) => role.userRoles, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'role_id' })
  role: Role;
}
