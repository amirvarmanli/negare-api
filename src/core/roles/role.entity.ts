import { Column, Entity, OneToMany } from 'typeorm';
import { BaseEntity } from '../../shared/base.entity';
import { UserRole } from '../user-roles/user-role.entity';

export enum RoleName {
  USER = 'user',
  SUPPLIER = 'supplier',
  ADMIN = 'admin',
}

@Entity({ name: 'roles' })
export class Role extends BaseEntity {
  @Column({
    type: 'enum',
    enum: RoleName,
    enumName: 'role_name_enum',
    unique: true,
  })
  name: RoleName;

  @OneToMany(() => UserRole, (userRole) => userRole.role)
  userRoles: UserRole[];
}
